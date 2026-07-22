Variante du script d'exemple Athom (@athombv/dsmr-parser) : au lieu d'afficher les trames DLMS dans la console, 
ce script les publie sur un broker MQTT avec le format "MQTT Discovery" de Home Assistant, pour que les capteurs 
apparaissent automatiquement.

Celui-ci est compatible avec les compteurs AM550 de la Romande Energie en Suisse

Activer l'API locale sur le dongle (requis)

Installez l'app Homey et ajoutez le dongle
Accédez aux réglages du dongle et dans Paramètres avancés, activez API locale
Notez l'adresse IP du dongle pour la renseigner dans HA

Installez ce script dans HA

  Dans l'onglet Configuration de l'add-on renseignez :
    dongle_ip : (l'adresse IP du dongle notée plus haut)
    mode : dlms (déjà par défaut)
    mqtt_host : core-mosquitto par défaut — si vous utilisez l'add-on officiel Mosquitto broker, laisse tel quel 
    mqtt_user / mqtt_password : si nécessaire
    Démarrez l'add-on, regardez l'onglet Logs — les lignes devraient apparaître
    Dans Paramètres → Appareils et services → MQTT, l'appareil "Compteur Romande Energie (AM550)" devrait apparaître avec ses capteurs


Exemple :
Publié: {
  power_w: 238,
  energy_total_kwh: 10319.238,
  energy_tariff1_kwh: 2190.324,
  energy_tariff2_kwh: 8128.914,
  voltage_l1: 245.9,
  voltage_l2: 245,
  voltage_l3: 246,
  current_l1: 0.08,
  current_l2: 0.98,
  current_l3: 0.19
}
