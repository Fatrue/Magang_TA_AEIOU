## SRUKTUR REPOSITORY

Web strukturnya kira2 gini entar:

```
brmp-irrigation/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   ├── utils/
│   │   └── main.tsx
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── mqtt/
│   │   ├── websocket/
│   │   ├── database/
│   │   ├── validators/
│   │   ├── utils/
│   │   └── server.ts
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   │
│   └── package.json
│
├── firmware/
│   ├── main-controller/
│   └── sensor-node/
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── mqtt.md
│   └── api.md
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Software/teknologi

- **Visual Studio Code** — pengembangan kode
- **React.js + Vite + TypeScript** — frontend
- **Node.js + Express.js + TypeScript** — backend/API
- **MySQL** — database
- **Prisma ORM** — pengelolaan database
- **Mosquitto MQTT** — komunikasi IoT
- **Socket.IO** — komunikasi real-time web
- **Git + GitHub** — version control
- **Docker** — deployment/development environment
- **Arduino IDE** / PlatformIO — pemrograman ESP32
- **Postman** — pengujian API

## WORKFLOW

## Tahap Sekarang : A - Prisma

**Tahap A — Design final**

> ERD [✓] → Prisma(& mysql) [] → API contract → MQTT contract → state machine

**Tahap B — Project setup**

> Git → Node.js → React → Express → MySQL → Prisma → Mosquitto

**Tahap C — Backend MVP**

> Auth → database → zones → sensors → irrigation → MQTT

**Tahap D — Frontend MVP**

> Login → Dashboard → Sensors → Irrigation → Zones → History

**Tahap E — IoT integration**

> ESP32 Main → MQTT → LoRa → Sensor Node → valve

**Tahap F — Integration & testing**

> Web → Backend → MQTT → ESP32 → valve → status kembali ke web
