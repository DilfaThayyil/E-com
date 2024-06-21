const express = require('express')
const app = express()
const path = require('path')
const userRouter = require('./router/userRouter')
const adminRouter = require('./router/adminRouter')
const mongoose = require('mongoose')
const flash = require('express-flash')
const session = require('express-session')
const crypto = require('crypto')
const onlineLogin=require('./onlineLogin')
require('dotenv').config()
const nocache=require('nocache')



app.use(nocache());
app.use(session({
    secret: crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: true,
  
  }))

app.set('view engine','ejs')




// connecting mongodb to server
mongoose.connect(process.env.MONGODB_URI).then(()=>{
    console.log("mongodb connected");
}).catch((err)=>{
    console.log("failed to connect"+err);
})
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(flash())
app.use(express.static(path.join(__dirname,'public')))
app.use('/',userRouter)
app.use('/admin',adminRouter)
app.use('/',onlineLogin)





app.listen(process.env.PORT,()=>{
    console.log("server is connected");
})


