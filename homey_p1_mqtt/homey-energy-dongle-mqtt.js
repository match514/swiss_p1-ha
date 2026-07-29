/*
 * Variante du script d'exemple Athom : au lieu d'afficher les trames DLMS dans la
 * console, ce script les publie sur un broker MQTT avec le format "MQTT Discovery"
 * de Home Assistant, pour que les capteurs apparaissent automatiquement.
 *
 * Usage :
 *   node homey-energy-dongle-mqtt.js <ip_dongle> <mode: dsmr|dlms> <mqtt_url> [decryption_key]
 *
 * Exemple :
 *   node homey-energy-dongle-mqtt.js 192.168.1.33 dlms mqtt://192.168.1.10:1883
 *
 * Si ton broker demande un login, mets-le dans l'URL :
 *   mqtt://user:password@192.168.1.10:1883
 */

import WebSocket, { createWebSocketStream } from 'ws';
import mqtt from 'mqtt';
import {
  DlmsStreamParser,
  UnencryptedDSMRStreamParser,
  EncryptedDSMRStreamParser,
} from '@athombv/dsmr-parser';

const ENERGY_DONGLE_IP = process.argv[2];
const MODE = process.argv[3];
const MQTT_URL = process.argv[4];
const DECRYPTION_KEY = process.argv[5];

if (!ENERGY_DONGLE_IP || !MODE || (MODE !== 'dsmr' && MODE !== 'dlms') || !MQTT_URL) {
  console.log(
    'Usage: node homey-energy-dongle-mqtt.js <ip> <mode: dsmr|dlms> <mqtt_url> [decryption_key]',
  );
  process.exit(1);
}

// --- Config Home Assistant / MQTT ---------------------------------------
const DEVICE_ID = 'romande_energie_compteur'; // identifiant unique de l'appareil
const DISCOVERY_PREFIX = 'homeassistant';
const STATE_TOPIC = `dsmr/${DEVICE_ID}/state`;

const device = {
  identifiers: [DEVICE_ID],
  name: 'Compteur Romande Energie (AM550)',
  manufacturer: 'Iskraemeco',
  model: 'AM550',
};

// Définition des capteurs : clé = nom du champ dans l'objet "payload" publié plus bas
const SENSORS = [
  { key: 'power_w', name: 'Puissance instantanée', unit: 'W', device_class: 'power' },
  { key: 'energy_total_kwh', name: 'Énergie totale', unit: 'kWh', device_class: 'energy', state_class: 'total_increasing' },
  { key: 'energy_tariff1_kwh', name: 'Énergie tarif 1 (HP)', unit: 'kWh', device_class: 'energy', state_class: 'total_increasing' },
  { key: 'energy_tariff2_kwh', name: 'Énergie tarif 2 (HC)', unit: 'kWh', device_class: 'energy', state_class: 'total_increasing' },
  { key: 'voltage_l1', name: 'Tension L1', unit: 'V', device_class: 'voltage' },
  { key: 'voltage_l2', name: 'Tension L2', unit: 'V', device_class: 'voltage' },
  { key: 'voltage_l3', name: 'Tension L3', unit: 'V', device_class: 'voltage' },
  { key: 'current_l1', name: 'Courant L1', unit: 'A', device_class: 'current' },
  { key: 'current_l2', name: 'Courant L2', unit: 'A', device_class: 'current' },
  { key: 'current_l3', name: 'Courant L3', unit: 'A', device_class: 'current' },
];

console.log(`Connexion au broker MQTT: ${MQTT_URL}`);
const mqttClient = mqtt.connect(MQTT_URL, {
  clientId: `dsmr-bridge-${Math.random().toString(16).slice(2, 8)}`,
  reconnectPeriod: 5000,
});

let discoveryPublished = false;

mqttClient.on('connect', () => {
  console.log('Connecté au broker MQTT');
  if (!discoveryPublished) {
    publishDiscovery();
    discoveryPublished = true;
  }
});

mqttClient.on('error', (err) => {
  console.log('Erreur MQTT:', err.message);
});

function publishDiscovery() {
  for (const sensor of SENSORS) {
    const objectId = `${DEVICE_ID}_${sensor.key}`;
    const configTopic = `${DISCOVERY_PREFIX}/sensor/${objectId}/config`;
    const config = {
      name: sensor.name,
      unique_id: objectId,
      state_topic: STATE_TOPIC,
      unit_of_measurement: sensor.unit,
      value_template: `{{ value_json.${sensor.key} }}`,
      device,
    };
    if (sensor.device_class) config.device_class = sensor.device_class;
    if (sensor.state_class) config.state_class = sensor.state_class;

    mqttClient.publish(configTopic, JSON.stringify(config), { retain: true });
  }
  console.log(`${SENSORS.length} capteurs déclarés via MQTT Discovery`);
}

function publishState(payload) {
  mqttClient.publish(STATE_TOPIC, JSON.stringify(payload));
}

// --- Extraction des valeurs utiles depuis une trame parsée ---------------
function extractPayload(result) {
  const elec = result.electricity ?? {};
  return {
    power_w: elec.powerReceivedTotal ?? null,
    energy_total_kwh: elec.total ? elec.total.received / 1000 : null,
    energy_tariff1_kwh: elec.tariffs?.['1'] ? elec.tariffs['1'].received / 1000 : null,
    energy_tariff2_kwh: elec.tariffs?.['2'] ? elec.tariffs['2'].received / 1000 : null,
    voltage_l1: elec.voltage?.l1 ?? null,
    voltage_l2: elec.voltage?.l2 ?? null,
    voltage_l3: elec.voltage?.l3 ?? null,
    current_l1: elec.current?.l1 ?? null,
    current_l2: elec.current?.l2 ?? null,
    current_l3: elec.current?.l3 ?? null,
  };
}

// --- Connexion au dongle Homey (identique au script d'origine) ----------
let ws;

process.on('SIGINT', () => {
  console.log('Arrêt...');
  if (ws) {
    ws.terminate();
    ws.close();
  }
  mqttClient.end();
  process.exit(0);
});

const address = `ws://${ENERGY_DONGLE_IP}:80/ws`;

while (true) {
  console.log(`Connexion à ${address}`);
  ws = new WebSocket(address);
  let interval;
  let receivedPong = false;

  ws.on('error', (error) => {
    console.log('Erreur WS:', error.message);
    ws.terminate();
  });

  ws.on('open', () => {
    console.log(`Connecté à ${address}`);
    interval = setInterval(() => {
      if (!receivedPong) {
        console.log('Pas de pong reçu, fermeture');
        ws.close();
        ws.terminate();
        return;
      }
      receivedPong = false;
      ws.ping();
    }, 10_000);
    ws.ping();
  });

  ws.on('pong', () => {
    receivedPong = true;
  });

  const stream = createWebSocketStream(ws);

  stream.on('error', (error) => {
    console.log('Erreur stream:', error.message);
    ws.terminate();
  });

  const parser = (() => {
    const callback = (error, result) => {
      if (error) {
        console.error('Erreur de parsing:', error.message);
        return;
      }
      const payload = extractPayload(result);
      publishState(payload);
      console.log('Publié:', payload);
    };

    if (MODE === 'dsmr' && !DECRYPTION_KEY) {
      return new UnencryptedDSMRStreamParser({ stream, detectEncryption: true, callback });
    }
    if (MODE === 'dsmr' && DECRYPTION_KEY) {
      return new EncryptedDSMRStreamParser({ stream, decryptionKey: DECRYPTION_KEY, callback });
    }
    return new DlmsStreamParser({ stream, decryptionKey: DECRYPTION_KEY, callback });
  })();

  await new Promise((resolve) => {
    ws.on('close', (code, reason) => {
      console.log('WS déconnecté:', code, reason.toString());
      clearInterval(interval);
      parser.destroy();
      resolve();
    });
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));
}
