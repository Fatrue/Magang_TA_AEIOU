import mqtt, { type MqttClient } from "mqtt";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";

let client: MqttClient | null = null;

export function getMqtt(): MqttClient {
  if (!client) throw new Error("Klien MQTT belum dimulai");
  return client;
}

export function connectMqtt(onMessage: (topic: string, payload: string) => void, topics: readonly string[]): MqttClient {
  client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    reconnectPeriod: 3000,
    clean: true,
  });

  client.on("connect", () => {
    logger.info("MQTT terhubung");
    client?.subscribe([...topics], { qos: 1 }, (err) => {
      if (err) logger.error({ err }, "gagal berlangganan topik MQTT");
    });
  });

  client.on("message", (topic, payload) => {
    try {
      onMessage(topic, payload.toString("utf8"));
    } catch (err) {
      logger.error({ err, topic }, "gagal memproses pesan MQTT");
    }
  });

  client.on("error", (err) => logger.error({ err }, "kesalahan MQTT"));
  client.on("reconnect", () => logger.warn("MQTT mencoba terhubung ulang"));

  return client;
}

export function publish(topic: string, message: string): void {
  if (!client) {
    logger.warn({ topic, message }, "MQTT belum tersambung, pesan tidak diterbitkan");
    return;
  }
  client.publish(topic, message, { qos: 1 }, (err) => {
    if (err) logger.error({ err, topic }, "gagal menerbitkan ke MQTT");
  });
}