import express from 'express';
import dotenv from 'dotenv';
import StorageModel from './models/storageModel.mjs';
import limiter from './middleware/rateLimiter.mjs';
import routes from './routes/routes.mjs';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);
app.use("/api", routes);

app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  const errorMessage = err.message || "Внутренняя ошибка сервера";

  if (req.accepts("json")) {
    res.status(statusCode).json({
      message: errorMessage,
      status: statusCode,
    });
  } else {
    res.status(statusCode).send(errorMessage);
  }
});

app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  const storage = new StorageModel();
  try {
    await storage.syncRepo();
  } catch (error) {
    console.error("Ошибка запуска синхронизации репозитория: ", error);
  } finally {
    await storage.initScheme();
    console.log("Схема проинициализирована");
  }
});