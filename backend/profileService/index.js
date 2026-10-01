const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config()
var cors = require('cors')


const app = express();
const port = Number(process.env.PORT || 3002);
const mongoUrl = process.env.MONGO_URL;

if (!mongoUrl) {
  throw new Error('MONGO_URL must be set');
}

mongoose.connect(mongoUrl).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Could not connect to MongoDB:', error.message);
  process.exit(1);
});

app.use(express.json());
app.use(cors())


app.get('/health', (req,res)=>{
    res.send({status: 'OK'})
})

app.get('/health/ready', (req,res)=>{
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({status: 'NOT_READY'});
    }
    return res.json({status: 'OK'});
})

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 1,
        maxlength: 200
    },
    age: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now()
    }
})
const User = mongoose.model('user', userSchema)

app.post('/addUser', async (req,res)=>{
    try {
        const { name, age } = req.body;
        if (!name || !age) {
          return res
            .status(400)
            .json({ error: "Both name and age are required." });
        }
        const existingUser = await User.find({name: name});
        if (!existingUser) {
          return res.status(404).json({ error: "User not found." });
        }
        const newuser = new User({
          name,
          age,
        });
        const savedUser = await newuser.save();
        res.status(201).json({ msg: "User Added Successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ err: "Internal Server Error" });
      }
})

app.get('/fetchUser', async (req,res)=>{
    try {
        let user = await User.find({});
        if (user) {
          res.send(user);
        } else {
          res.send({ msg: "User doesn't exist" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ msg: "Something went wrong" });
      }
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Profile service is listening on port ${port}`);
});
