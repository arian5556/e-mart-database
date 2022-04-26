const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();
var admin = require("firebase-admin");
const stripe = require("stripe")(
  "sk_test_51KiCK6HlIpHzNhGaImExltHRso4TWkngHu4PTIoByELTQKii5jrQtutjdPqoYJcXRfeO1lJ7Q6B9Hsyl010rIBYO00aDYqRX9o"
);
var serviceAccount = require("./emart-d064b-firebase-adminsdk-wq28u-55f7dc8fa4.json");

const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9qbam.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const idToken = req.headers.authorization.split("Bearer ")[1];
    try {
      const decoderUser = await admin.auth().verifyIdToken(idToken);
      req.decodedUserEmail = decoderUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("emart");
    const productCollection = database.collection("products");
    const orderCollection = database.collection("orders");

    app.get("/products", async (req, res) => {
      const cursor = productCollection.find({});
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let products;
      const count = await cursor.count();
      if (page) {
        products = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();
      } else {
        products = await cursor.toArray();
      }
      res.json({ count, products });
    });

    app.post("/products/bykeys", async (req, res) => {
      const keys = req.body;
      const query = { key: { $in: keys } };
      const result = await productCollection.find(query).toArray();
      res.json(result);
    });

    app.post("/orders", async (req, res) => {
      const order = req.body;
      order.createdAt = new Date();
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });

    app.get("/orders", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (req.decodedUserEmail == email) {
        const query = { email: email };
        const cursor = orderCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } else {
        res.status(401).json({ message: "user not authorized" });
      }
    });

    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("emart database Running");
});

app.listen(port, () => {
  console.log("Listening to port", port);
});
