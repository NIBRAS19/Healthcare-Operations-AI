import mongoose from "mongoose";
import { config } from "./config.js";
import { app } from "./app.js";

mongoose.set("sanitizeFilter", true); // blocks NoSQL operator injection in filters
await mongoose.connect(config.mongoUri);
const server = app.listen(config.port, () => console.log(`CareOps API listening on :${config.port} (${config.env})`));
const stop = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
process.on("SIGTERM", stop); process.on("SIGINT", stop);
