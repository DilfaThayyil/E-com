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
const Wishlist = require('../model/wishlistSchema')




const allProducts = async (req,res)=>{
    try{
        const limit = 4
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;
        const products = await Product.find({Status:"active"}).populate({
            path: 'Category',
            populate: { path: 'offer' }
        })
        .populate('offer')
        .skip(skip)
        .limit(limit)
        const offer = await Offer.find()
        const product = products.filter(product => product.Category.Status !== "blocked");
        const category = await Category.find({Status:"active"})
        const totalProducts = await Product.countDocuments({ Status: "active" });

        
        res.render('allproducts',{
            product,
            category,
            message:req.query.message,
            offer,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            limit: limit
        })
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


const wishlist = async(req,res)=>{
    try{
        const userId = req.session.user
        const wishlist = await Wishlist.findOne({userid:userId}).populate({
            path:"products.productId",
            model:"Products",
            populate: [
                { path: 'offer' },
                { 
                    path: 'Category',
                    populate: { path: 'offer' }
                }
            ]
        })
        if(!wishlist){
            return res.render('wishlist',{wishlist:null})
        }
        res.render('wishlist',{wishlist})
    }catch(err){
        console.log(err)
    }
}


const addToWishlist =async(req,res)=>{
    try{
        const productId = req.params.id
        const userId = req.session.user
        const check = await Product.findById(productId).populate({
            path: 'Category',
            populate: { path: 'offer' }
        }).populate('offer');
        
        if(!userId){
            return res.json({error:'User not authenticated'})
        }
        const userWishlist = await Wishlist.findOne({userid:userId})
        let product = {
            productId : productId
        }

        if(!userWishlist){
            const newWishlist = new Wishlist({
                userid : userId,
                products : [product]
            })
            await newWishlist.save()
        }else{
            const productIndex = userWishlist.products.findIndex(product => product.productId.toString() === productId);
            if(productIndex === -1){
                userWishlist.products.push(product)
            }
            
            await userWishlist.save()
        }
        res.json({message:'Product added to wishlist successfully'})
    }catch(err){
        console.log(err)
    }
}

const removeFromWish = async(req,res)=>{
    try{
        const productId = req.params.id
        const result = await Wishlist.updateOne(
            { "products.productId": productId },
            { $pull: { products: { productId: productId } } }
        )

        if(result.deletedCount > 0){
            res.json({message:"Product removed from wishlist successfully"})
        }else{
            res.json({error: "Product not found in wishlist"})
        }
    }catch(err){
        console.log(err)
    }
}







module.exports={
    allProducts,
    singleProduct,
    categorybased,
    sortedProducts,
    wishlist,
    addToWishlist,
    removeFromWish
}