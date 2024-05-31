const User = require('../model/userSchema')

const isLoged = (req,res,next)=>{
    try{
        if(req.session.user){
            res.redirect('/')
        }else{
            next()
        }
    }catch(err){
        console.log(err);
    }
}

const notLoged = (req,res,next)=>{
    try{
        if(!req.session.user){
            res.redirect('/login')
        }else{
            next()
        }
    }catch(err){
        console.log(err);
    }
}

const isBlocked = async(req,res,next)=>{
    try{
        const user = await User.findOne({_id:req.session.user})
       if(user){
        if(user.isBlocked==true){
            req.session.user=null
            req.session.name=null
            res.redirect('/')
        }else{
            next()
        }
       }else{
            next()
        }
    }catch(err){
        console.log(err)
    }
}

module.exports={
    isLoged,
    notLoged,
    isBlocked
}