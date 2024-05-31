const User = require('../model/userSchema')
const Product = require('../model/products')
const bcrypt =require('bcrypt')
const Category = require('../model/category')
const otpSchema = require('../model/otp')
const Cart = require('../model/cart')
const nodemailer = require('nodemailer');
const Order = require('../model/orderSchema')
const Coupon = require('../model/couponSchema')
const Offer = require('../model/offerSchema')




const allProducts = async (req,res)=>{
    try{
        const products = await Product.find({Status:"active"}).populate({
            path: 'Category',
            populate: { path: 'offer' }
        }).populate('offer')
        const offer = await Offer.find()
        const product = products.filter(product => product.Category.Status !== "blocked");
        const category = await Category.find({Status:"active"})
        
        res.render('allproducts',{product,category,message:req.query.message,offer})
    }catch(err){
        console.log(err);
    }
}

const singleProduct = async(req,res)=>{
    try{
        const singleproductId =req.params.id
        const userId = req.session.user
        const product = await Product.findById(singleproductId) .populate({
            path: 'Category',
            populate: { path: 'offer' }
        }).populate('offer')
        const offer = await Offer.find()
        const recommend = await Product.find({Category:product.Category._id}).limit(4)
        const cart = await Cart.findOne({userid:userId})
    
        if(cart){
          let already=cart.products.forEach(product=>{
                if(product.productId==singleproductId){
                    return true
                }else{
                    return  false
                }
            })
        }
       
        res.render('singleproduct',{product,recommend,offer})
    }catch(err){
        console.log(err);
    }
}

const categorybased = async(req,res)=>{
    try{
        const categoryid = req.params.id
        const totalProducts = await Product.find({Category:categoryid}).populate({
            path: 'Category',
            populate: { path: 'offer' }
        }).populate('offer')
        const category = await Category.find({Status:"active"})
        res.render('categorybased', { category,totalProducts});
    }catch(err){
        console.log(err);
    }
}


const sortedProducts = async(req,res)=>{
    try {
        let products;
        const sortBy = req.query.sortBy; 
        
        if (sortBy === 'priceLowToHigh') {
            products = await Product.find({ Status: "active" }).sort({ Price: 1 }).populate('Category');
        } else if (sortBy === 'priceHighToLow') {
            products = await Product.find({ Status: "active" }).sort({ Price: -1 }).populate('Category');
        } else if (sortBy === 'nameAtoZ') {
            products = await Product.find({ Status: "active" }).sort({ Name: 1 }).populate('Category');
        } else if (sortBy === 'nameZtoA') {
            products = await Product.find({ Status: "active" }).sort({ Name: -1 }).populate('Category');
        } else {
            products = await Product.find({ Status: "active" }).populate('Category');
        }
        
        const filteredProducts = products.filter(product => product.Category.Status !== "blocked");
        
        const categories = await Category.find({ Status: "active" });
        res.json({product: filteredProducts, category: categories, message: req.query.message}) 
    } catch (err) {
        console.log(err);
    }
}



module.exports={
    allProducts,
    singleProduct,
    categorybased,
    sortedProducts
}