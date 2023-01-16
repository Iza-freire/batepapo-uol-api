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

const messageValidationSchema=joi.object({
    to: joi.string().min(1).required(),
    text: joi.string().min(1).required(),
    type: joi.string().valid("message", "private_message").required(),
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
            text: "entra na sala...",
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
    try {
        const allParticipants = await participants.find({}).toArray();
        res.json(allParticipants);
    } catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});

app.post("/messages", async (req, res) => {
    const serverMes = req.body;
    const user = req.headers.user;

    try {
        const validation = messageValidationSchema.validate(serverMes, { abortEarly: false });

        const message = {
            from: user,
            ...serverMes,
            time: dayjs().format("HH:mm:ss")
        };

        if (validation.error) {
            const errors = validation.error.details.map((detail) => detail.message);
            res.status(422).send(errors);
            return;
        }

        const participantExists = await db.collection("participants").findOne({ name: user });

        if (!participantExists) {
            res.sendStatus(422);
            return;
        }

        await db.collection("messages").insertOne(message);
        res.sendStatus(201);

    } catch (error) {
        res.status(500).send(error.message);
    }
});
app.get("/messages", async (req, res)=>{
    const limit=req.query.limit;
    const {user}=req.headers;

    try{
        const messages = await db.collection("messages").find({ $or: [{ from: user }, { to: "Todos" }, { to: user }] }).toArray();
        
        if (!limit) return res.send(messages);
        
        if (limit > 0 && parseInt(limit)!== "NaN") {
            const dados = messages.reverse().slice(0, parseInt(limit));
            return res.send(dados);
        }else{
            return res.sendStatus(422);
        }
        
    }catch(error){
        res.status(500).send(error.message);
    }
});




app.post("/status", async (req, res) => {
  const { user } = req.headers;

  try {
    const participantExists = await participants.findOne({
      name: user,
    });

    if (!participantExists) {
      return res.sendStatus(404);
    }

    await participants.updateOne(
      { name: user },
      { $set: { lastStatus: Date.now() } }
    );

    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

setInterval(async () => {
    const inactiveParticipants = await participants.find({ lastStatus: { $lt: Date.now() - 10000 } }).toArray();
    if (inactiveParticipants.length > 0) {
        await participants.deleteMany({ lastStatus: { $lt: Date.now() - 10000 } });
        for (let i = 0; i < inactiveParticipants.length; i++) {
            await messages.insertOne({
                from: inactiveParticipants[i].name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().format("HH:mm:ss"),
            });
        }
    }
}, 15000);




app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
