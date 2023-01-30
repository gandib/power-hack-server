const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const bcrypt = require('bcrypt');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jsxpj9d.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorizes access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' });
        }
        req.decoded = decoded;
        next();
    })
};



async function run() {
    try {
        await client.connect();
        console.log('DB connected');

        const billsCollection = client.db('power-bills').collection('bills');
        const userCollection = client.db('power-bills').collection('users');


        app.post('/api/add-billing', verifyJWT, async (req, res) => {
            try {
                const bill = req.body;
                const result = await billsCollection.insertOne(bill);
                res.send({ success: true, result });
            } catch (error) {
                res.send({ success: true, message: 'There was a server side error!' });
            }
        });

        app.post('/api/registration', async (req, res) => {
            try {
                const hashedPassword = await bcrypt.hash(req.body.password, 10);
                const user = req.body;
                const users = {
                    email: req.body.email,
                    password: hashedPassword,
                };
                console.log(req.body)
                const result = await userCollection.insertOne(users);
                res.send({ success: true, result });
            } catch (error) {
                res.send({ success: false, message: 'Signup failed!' });
            }
        });

        app.post('/api/login', async (req, res) => {
            try {
                const user = await userCollection.findOne({ email: req.body.email });
                console.log(user);
                if (user) {
                    const isValidPassword = await bcrypt.compare(req.body.password, user.password);
                    console.log(isValidPassword);
                    if (isValidPassword) {
                        // generate token
                        const token = jwt.sign({
                            email: user.email,
                            userId: user._id
                        }, process.env.ACCESS_TOKEN_SECRET, {
                            expiresIn: '1hr'
                        });

                        res.status(200).json({
                            success: true,
                            'accessToken': token,
                            'message': 'Login Successful!'
                        });
                    }
                    else {
                        res.status(401).json({
                            "error": "Authentication failed!"
                        });
                    }
                }
                else {
                    res.status(401).json({
                        "error": "Authentication failed!"
                    });
                }
            }
            catch {
                res.status(401).json({
                    "error": "Authentication failed!"
                });
            }
        });

        app.get('/api/billing-list', verifyJWT, async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const query = {};
            const cursor = billsCollection.find(query);
            const allBills = await billsCollection.find(query).toArray();

            let bills;
            if (page || size) {
                bills = await cursor.sort({ createdAt: -1 }).skip(page * size).limit(size).toArray();
            }
            else {
                bills = await cursor.sort({ createdAt: -1 }).toArray();
            }

            res.send({ allBills, bills });
        });

        app.put('/api/update-billing/:id', verifyJWT, async (req, res) => {

            const id = req.params.id;
            const bill = req?.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name: bill.data.name,
                    email: bill.data.email,
                    phone: bill.data.phone,
                    amount: bill.data.amount,
                }
            }
            const updatedBill = await billsCollection.updateOne(filter, updatedDoc);
            res.send(updatedDoc);
        });

        app.delete('/api/delete-billing/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await billsCollection.deleteOne(filter);
            res.send(result);
        });

        app.get('/api/search-by-fullname', verifyJWT, async (req, res) => {
            const name = req.query;
            console.log(name);
            const filter = { name: new RegExp(name, "i") };
            const result = await billsCollection.find(filter).toArray();
            res.send(result);
        });

        app.get('/api/search-by-email', verifyJWT, async (req, res) => {
            const email = req.query;
            console.log(email);
            const filter = { email };
            const result = await billsCollection.find(filter).toArray();
            res.send(result);
        });

        app.get('/api/search-by-phone', verifyJWT, async (req, res) => {
            const phone = req.query;
            console.log(phone);
            const filter = { phone };
            const result = await billsCollection.find(filter).toArray();
            res.send(result);
        });

    }
    finally {

    }

}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send("Power-Hack Running");
});

app.listen(port, () => {
    console.log("Power-Hack Listening on port", port);
});