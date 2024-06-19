const User = require('../model/userSchema')
const Product = require('../model/products')
const bcrypt =require('bcrypt')
const otpSchema = require('../model/otp')
const nodemailer = require('nodemailer');
const Order = require('../model/orderSchema')
const Coupon = require('../model/couponSchema')
const Offer = require('../model/offerSchema')





// HOME PAGE

const home = async(req,res)=>{
    try{
        const user=req.session.name
        const limit = 4
        const page = parseInt(req.query.page) || 1
        const skip = (page - 1) * limit
        const products = await Product.find({Status:'active'}).populate({
            path: 'Category',
            populate: { path: 'offer' }
        })
        .populate('offer')
        .skip(skip)
        .limit(limit)
        const offer = await Offer.find()
        const product = products.filter(product => product.Category.Status !== "blocked");
        const totalProducts = await Product.countDocuments({ Status: "active" });

        res.render('home',{
            product,
            user,
            offer,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            limit: limit
        })
    }catch(err){
        console.log(err);
    }
}


// lOGIN PAGE

const login = (req,res)=>{
    try{
        const msg = req.flash('err')
        res.render('login',{msg})
    }catch(err){
        console.log(err);
    }
}

// SIGNUP PAGE

const register = (req,res)=>{
    try{
        const msg = req.flash('err')
        const Referral = req.query.referralCode
        res.render('register',{Referral,msg})
    }catch(err){
        console.log(err);
    }
}

// SIGNUP SUBMISSION

const registerSubmit = async (req,res)=>{
    try{
        const Referral = req.body.Referral
        const {name,email,mobileNumber,password} = req.body
        const check = await User.findOne({Email:email})
        if(check){
            const message = "email already exist"
            req.flash('err',message)
            return res.redirect('/register')
        }else{  
           const bcryptPassword=  await bcrypt.hash(password,10)
           
            const user = {
                Name : name,
                Email : email,
                PhoneNumber : mobileNumber,
                password : bcryptPassword ,
                ReferId:name+Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000

            }
            otp(email,name)
           if(Referral){
            req.session.Referral=Referral
           }
            req.session.userData = user
            res.redirect(`/otp`)
        }
    }catch(err){
        console.log(err);
    }
}


// LOGIN SUBMISSION

const loginSubmit = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({Email:email});
        if (user) {
            const passwordMatch = await bcrypt.compare(password, user.password); 
            if (passwordMatch) {
                if(user.isBlocked){
                    const msg = 'Your account is blocked'
                    req.flash('err',msg)
                    res.redirect('/login')
                    
                }else{
                    req.session.user = user._id;
                    req.session.name = user.Name;
                    res.redirect('/');
    
                }
            } else {
                const error = "Password is incorrect";
                req.flash('err', error);
                res.redirect('/login');
            }
        } else {
            const error = "Email not found";
            req.flash('err', error);
            res.redirect('/login');
        }
    } catch (err) {
        console.log(err);
        res.status(500).send("Internal Server Error");
    }
}



async function otp  (Email,Name){
    let Otp = Math.floor(Math.random() * 9000) + 1000;
    const otp = new otpSchema({
        email:Email,
        name:Name,
        otp:Otp
    })
  let userotp = await otp.save()
// Create a transporter object using SMTP transport
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'dilfathayyil@gmail.com', // Your Gmail address
        pass: 'ydwv upst yblp igrq' // Your Gmail password
    }
});

// Define email message options
let mailOptions = {
    from: 'dilfathayyil@gmail.com',
    to: `${Email}`,
    subject: 'Otp verification',
    text: `Dear ${Name} , Your otp is ${userotp.otp} . it will expire in 2 minutes`
};

// Send email
transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
        console.log('Error occurred:', error);
    } else {
        console.log('Email sent:', info.response);
    }
});

}

// OTP PAGE

const otppage = async(req,res)=>{
    try{
        const errmsg = req.flash('err')
        let msg = 'Please check your mail'
        res.render('otp',{msg,errmsg})
    }catch(err){
        console.log(err);
    }
}


// OTP SUBMISSION

const otpSubmit = async (req, res) => {
    try {
        const { digit1, digit2, digit3, digit4 } = req.body;
        const otpnumber =  digit1 + digit2 + digit3 + digit4;
        const user = req.session.userData;
        const check = await otpSchema.findOne({ email: user.Email });
        
        if (check.otp == otpnumber) {
            const insertuser = new User(user);
            await insertuser.save();

            const ref=req.session.Referral
            if(ref){
                const user=await User.findOne({ReferId:ref})
                 user.wallet+=250
                 insertuser.wallet+=250
                 const transaction = {
                    amount : 250,
                    description: 'By Referred',
                    date : new Date(),
                    status : 'in'
                  }
                  user.walletHistory.push(transaction)
                  insertuser.walletHistory.push(transaction)
                 await insertuser.save();
                 await user.save()
            }
            
            req.session.user = insertuser._id;
            req.session.name = insertuser.Name;
            req.session.userData = null;
            res.json({ success: true, message: "OTP verified successfully." });
        } else {
            res.status(400).json({ success: false, message: "OTP is invalid" });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "An error occurred." });
    }
};


// RESEND OTP

const resendotp = async (req,res)=>{
    try{
        const user = req.session.userData
        otp(user.Email,user.Name)
        res.json({success:true})
    }catch(err){
        console.log(err)
    }
}


// LOGOUT 

const logout = async(req,res)=>{
    try{
        req.session.user=null
        req.session.name = null
        res.redirect('/')
    }catch(err){
        console.log(err);
    }
}





// FORGOT PASSWORD

const forgotPassword = async(req,res)=>{
    try{
        const {email} = req.body
        const resetToken = Math.floor(Math.random() * 9000) + 1000;
        const token = await storeResetToken(email, resetToken);
        let message = ''
        if (token) {
            sendResetLink(email, resetToken);
            message = 'Reset link has been sent to your email.'
          setTimeout(()=>{
            res.redirect('/login')
          },10000)
        } else {
            console.log("Error sending reset link")
            res.render('forgotPassword',{msg,errmsg})
        }
    }catch(err){
        console.log(err)
    }
}


// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'dilfathayyil@gmail.com',
        pass: 'ydwv upst yblp igrq'
    }
});



// Function to send reset link
function sendResetLink(email, resetToken) {
    const mailOptions = {
        from: 'dilfathayyil@gmail.com',
        to: email,
        subject: 'Password Reset Link',
        html: `<p>Click the following link to reset your password:</p>
               <a href="http://localhost:3000/resetPassword?token=${resetToken}">Reset Password</a>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending reset link:', error);
        } else {
            console.log('Reset link sent:', info.response);
        }
    });
}




async function storeResetToken(email, resetToken) {
    try {
        const user = await User.findOne({Email:email });

        if (!user) {
            console.error('User not found');
            return;
        }

        user.resetToken = resetToken;
        user.resetTokenExpires = Date.now() + 3600000; 
        await user.save();

        return resetToken
    } catch (error) {
        console.error('Error storing reset token:', error);
        return
    }
}


// RESET PASSWORD

const resetPassword=async(req,res)=>{
    try{
        const token=req.query.token
        res.render('resetPassword',{token})
    }catch(err){
        console.log(err)
    }
}

// RESET PASSWORD SUBMISSION

const resetPasswordSubmit=async(req,res)=>{
    try{
        const {confirmPassword} = req.body
        const token=req.body.token
        
        const user = await User.findOne({resetToken:token})

        
            const hashedPassword = await bcrypt.hash(confirmPassword,10);
            user.password = hashedPassword;
            user.resetToken = null;
            user.resetTokenExpirationDate = null; 
            await user.save();
            res.redirect('/login')
           
    }catch(err){
            console.log(err)
    }
}


// USER PROFILE

const userProfile = async(req,res)=>{
    try{
        const userid = req.session.user

        //orders pagination
        const ordersPerpage = 3; 
        const ordersPage = parseInt(req.query.ordersPage) || 1; 
        const totalOrders = await Order.countDocuments({userid: userid});
        const totalOrdersPages = Math.ceil(totalOrders / ordersPerpage);
        let orders = await Order.find({userid:userid})
            .populate({
                path:"products.products",
                model:"Products"
            })
            .skip((ordersPage - 1) * ordersPerpage)
            .limit(ordersPerpage)
            .sort({date: -1})
            .exec()

        //coupons pagination    
        const couponsPerPage = 2
        const couponsPage = parseInt(req.query.couponsPage) || 1
        const totalCoupons = await Coupon.countDocuments()
        const totalCouponsPages = Math.ceil(totalCoupons / couponsPerPage)
        const coupon = await Coupon.find()
            .skip((couponsPage - 1) * couponsPerPage)
            .limit(couponsPerPage)
            .exec()


            const addressesPerPage = 2;
            const addressesPage = parseInt(req.query.addressesPage) || 1;
            const user = await User.findById(userid);
            const totalAddresses = user.Addresses.length;
            const totalAddressesPages = Math.ceil(totalAddresses / addressesPerPage);
            const addresses = user.Addresses.slice((addressesPage - 1) * addressesPerPage, addressesPage * addressesPerPage);


            const datePart = new Date().toISOString().slice(0,10).replace(/-/g,"");
            const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
            const randomId = `ORD${datePart}${randomPart}`


        res.render('profile',{
            randomId,
            orders,
            ordersCurrentPage:ordersPage,
            totalOrdersPages,
            coupon,
            couponsCurrentPage:couponsPage,
            totalCouponsPages,
            user,
            addresses,
            addressesCurrentPage: addressesPage,
            totalAddressesPages
            
        })
    }catch(err){
        console.log(err);
    }
}



const editProfile = async(req,res)=>{
    try{
        const userid = req.session.user
        const {name,phone} = req.body
        const user = await User.findById(userid)
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
            user.Name = name
            user.PhoneNumber = phone
        await user.save()
        return res.json({success:true , message:'Profile updated successfully', user})
    }catch(err){
        console.log(err)
    }
}

const profileAddAddress = async(req,res)=>{
    try{
        const {name,phone,email,address,pincode,state,city} = req.body
        const userid = req.session.user
        const user = await User.findById(userid)

        user.Addresses.push({
            name,
            phone,
            email,
            address,
            pincode,
            state,
            city
        })
        await user.save()
        res.redirect('/userProfile')
    }catch(err){
        console.log(err);
    }
}


const editAddress = async (req, res) => {
    try {
        const { name, phone, email, address, pincode, state, city, addressId } = req.body;
        const userid = req.session.user;
        const userAddress = await User.findById(userid);
        
        if (!userAddress) {
            return res.json({ message: 'User not found' });
        }

        try {
            await User.findOneAndUpdate(
                { _id: userid, 'Addresses._id': addressId }, 
                {
                    $set: {
                        'Addresses.$.name': name,
                        'Addresses.$.phone': phone,
                        'Addresses.$.email': email,
                        'Addresses.$.address': address,
                        'Addresses.$.pincode': pincode,
                        'Addresses.$.state': state,
                        'Addresses.$.city': city,
                    },
                }
            );

            res.json({ message: 'Address updated successfully' });
        } catch (error) {
            console.error('Error updating address:', error);
            res.json({ message: 'Internal Server Error' });
        }
    } catch (err) {
        console.log(err);
        res.json({ message: 'Internal server Error' });
    }
};




const removeAddress=async (req,res)=>{
    try{
        const userid = req.session.user
        const addressid = req.params.id

        const user = await User.findById(userid)
        if(!user){
            res.json({message:"user not found"})
        }

        user.Addresses.pull({_id:addressid})
        res.json({message:"Address removed successfully"})
        await user.save()
    }catch(err){
        console.log(err);
    }

}



const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const oldPassword = req.body.currentPassword

        const userId = req.session.user;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (!user.password) {
            return res.status(400).json({ success: false, message: 'Password is missing from user data' });
        }

        const passwordMatch = await bcrypt.compare(currentPassword,user.password);
        if (!passwordMatch) {
            return res.status(400).json({ error: "Incorrect current password" });
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedNewPassword;
        await user.save();
        
        res.json({success: true, message: 'Password changed successfully' });


    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
};

const contactUs = async(req,res)=>{
    try{
        res.render('contactUs')
    }catch(err){
        console.log(err);
    }
}

const aboutUs = async(req,res)=>{
    try{
        res.render('aboutUs')
    }catch(err){
        console.log(err)
    }
}


const page404 = async(req,res)=>{
    try{
        res.render('404')
    }catch(err){
        console.log(err)
    }
}

  
    

module.exports={
    home,
    login,
    register,
    registerSubmit,
    loginSubmit,
    otppage,
    otpSubmit,
    logout,
    resendotp,
    forgotPassword,
    resetPassword,
    resetPasswordSubmit,
    userProfile,
    editProfile,
    editAddress,
    profileAddAddress,
    removeAddress,
    changePassword,
    contactUs,
    aboutUs,
    page404
}