


const isLoged = (req,res,next)=>{
    try{
        if(req.session.admin){
            res.redirect('/admin')
        }else{
            next()
        }
    }catch(err){
        console.log(err);
    }
}


const notLoged = (req,res,next)=>{
    try{
        if(!req.session.admin){
            res.redirect('/admin/login')
        }else{
            next()
        }
    }catch(err){
        console.log(err);
    }
}


module.exports={
    isLoged,
    notLoged
}