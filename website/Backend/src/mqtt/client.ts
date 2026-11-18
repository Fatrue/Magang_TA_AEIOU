import mqtt, { type MqttClient } from "mqtt";
import { env } from "../env.js";
import { logger } from "../lib/logger.js";
import { conflict } from "../lib/HttpError.js";

let client: MqttClient | null = null;

export function getMqtt(): MqttClient {
  if (!client) throw new Error("Klien MQTT belum dimulai");
  return client;
}

export function connectMqtt(onMessage: (topic: string, payload: string) => Promise<void>, topics: readonly string[]): MqttClient {
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

  let inbound: Promise<void> = Promise.resolve();
  client.on("message", (topic, payload) => {
    // Menjaga urutan ON/OFF saat handler melakukan query basis data.
    inbound = inbound.then(() => onMessage(topic, payload.toString("utf8")))
      .catch((err) => { logger.error({ err, topic }, "gagal memproses pesan MQTT"); });
  });

  client.on("error", (err) => logger.error({ err }, "kesalahan MQTT"));
  client.on("reconnect", () => logger.warn("MQTT mencoba terhubung ulang"));

  return client;
}

export async function publish(topic: string, message: string): Promise<void> {
  if (!client?.connected) {
    throw conflict("Broker MQTT belum terhubung. Perintah tidak terkirim.");
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(conflict("Pengiriman ke broker belum terkonfirmasi. Periksa perangkat sebelum mencoba lagi.")), 5000);
    client!.publish(topic, message, { qos: 1 }, (err) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    });
  });
}
