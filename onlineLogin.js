const express=require('express')
const app = express()
const passport=require('passport')
const axios=require('axios')
const CLIENT_ID= process.env.CLIENT_ID
const CLIENT_SECRET= process.env.CLIENT_SECRET
const REDIRECT_URI = process.env.REDIRECT_URI
const bcrypt=require('bcrypt')
const User=require('./model/userSchema')
require('dotenv').config()
  

// login with google

    app.get('/auth/google',(req,res)=>{
      const Referral = req.query.referralCode
      if(Referral){
        req.session.Referral=Referral
       }
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=profile email`
    res.redirect(url)
  })

    app.get('/auth/google/callback',async (req,res)=>{
    const{code}=req.query
    try{
      const {data}=await axios.post('https://oauth2.googleapis.com/token',{
        client_id:CLIENT_ID,
        client_secret:CLIENT_SECRET,
        code,
        redirect_uri:REDIRECT_URI,
        grant_type:'authorization_code'
      })
      const {access_token,id_token}=data
  
      const {data:profile}=await axios.get('https://www.googleapis.com/oauth2/v1/userinfo',{
        headers:{authorization:`Bearer ${access_token}`},
  
      })

      let user= await User.findOne({Email:profile.email})
      if(user){
        req.session.user=user._id
        req.session.name=user.Name
        return res.redirect('/')
      }else{
        const bcryptPassword=  await bcrypt.hash(profile.id,10)
        let name=profile.name.split(' ')[0]
        const newUser= new User({
            Name:profile.name,
            Email:profile.email,
            password:bcryptPassword,
            ReferId:name+Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000


        })
          let ref=req.session.Referral
        if( ref){
          const user=await User.findOne({ReferId:ref})
          user.wallet+=250
          newUser.wallet+=250
          const transaction = {
             amount : 250,
             description: 'By Referred',
             date : new Date(),
             status : 'in'
           }
           user.walletHistory.push(transaction)
           newUser.walletHistory.push(transaction)
           await user.save()
           req.session.Referral=null
        }


       let user= await newUser.save()
        req.session.user=user._id
        req.session.name=user.Name

      }


      res.redirect('/')
    }catch(error){
      console.log(error);
    }
  })




  


  module.exports=app