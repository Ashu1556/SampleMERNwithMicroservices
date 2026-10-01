const express = require('express');
require('dotenv').config()
var cors = require('cors')


const app = express();
app.use(cors())


app.use(express.json());
app.get('/', (req,res)=>{
    res.send({msg: 'Hello World'})
})
app.get('/health', (req,res)=>{
    res.send({status: 'OK'})
})

const port = Number(process.env.PORT || 3001);

app.listen(port, '0.0.0.0', () => {
  console.log(`Hello service is listening on port ${port}`);
});
