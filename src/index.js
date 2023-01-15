import express from "express"
import dotenv from "dotenv"
dotenv.config()
import cors from "cors";

const app = express();

app.listen(5000, () => console.log("Running"));