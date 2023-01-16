import express from "express"
import dotenv from "dotenv"
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";


dotenv.config();
const app = express();
const port = 5000;

app.use(express.json());

const participantValidationSchema = joi.object({
    name: joi.string().required().min(2),
});

const mongoClient = new MongoClient(process.env.DATABASE_URL, { useNewUrlParser: true });

const db = mongoClient.db();
const participants = db.collection("participants");
const messages = db.collection("messages");


app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const { error } = participantValidationSchema.validate({ name }, { abortEarly: false });

    if (error) {
        const errors = error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const participantExists = await participants.findOne({ name });
        if (participantExists) {
            return res.sendStatus(409);
        }

        await participants.insertOne({ name, lastStatus: Date.now() });

        await messages.insertOne({
            from: name,
            to: "Todos",
            text: "entrei na sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss"),
        });

        res.sendStatus(201);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

app.get('/participants', async (req, res) => {
    const allParticipants = await participants.find({}).toArray();
    res.send(allParticipants);
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
