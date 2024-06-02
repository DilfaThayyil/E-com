const User = require('../model/userSchema')
const Product = require('../model/products')
const bcrypt =require('bcrypt')
const Category = require('../model/category')
const otpSchema = require('../model/otp')
const Cart = require('../model/cart')
const nodemailer = require('nodemailer');
const Order = require('../model/orderSchema')
const Coupon = require('../model/couponSchema')
require('dotenv').config()
const Razorpay = require('razorpay')
const {key_id,key_secret} = process.env
const crypto = require('crypto')




const cart = async(req,res)=>{
    try{
        const userId = req.session.user
        const cart = await Cart.findOne({ userid: userId }).populate({
            path: 'products.productId',
            model: 'Products',
            populate: [
                { path: 'offer' },
                { 
                    path: 'Category',
                    populate: { path: 'offer' }
                }
            ]
        });

        if (!cart) {
            return res.render('cart', { cart: null, totalPrice: 0, subtotal: 0 });
        }

        let totalPrice = cart.products.reduce((total, product) => {
            return total + product.totalPrice;
        }, 0);
        subtotal = totalPrice
        let shipping = 50
        totalPrice = totalPrice+shipping
        res.render('cart',{cart,totalPrice,subtotal })
    }catch(err){
        console.log(err);
    }
}


const addToCart = async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.session.user;
        const quantity = parseInt(req.params.qnt, 10);

        if (!userId) {
            return res.json({ error: 'User not authenticated' });
        }

        const productToCart = await Product.findById(productId).populate({
            path: 'Category',
            populate: { path: 'offer' }
        }).populate('offer');

        if (!productToCart) {
            return res.json({ error: 'Product not found' });
        }

        let productPrice;
        if (productToCart.offer) {
            productPrice = Math.floor(productToCart.Price - (productToCart.Price * productToCart.offer.percentage / 100));
        } else if (productToCart.Category.offer) {
            productPrice = Math.floor(productToCart.Price - (productToCart.Price * productToCart.Category.offer.percentage / 100));
        } else {
            productPrice = productToCart.Price;
        }

        const userCart = await Cart.findOne({ userid: userId });

        if (!userCart) {
            // If cart does not exist, create a new cart with the product
            const newCart = new Cart({
                userid: userId,
                products: [{
                    productId: productId,
                    quantity: quantity,
                    totalPrice: quantity * productPrice
                }]
            });
            await newCart.save();
        } else {
            // If cart exists, check if product is already in the cart
            const productIndex = userCart.products.findIndex(product => product.productId.toString() === productId);

            if (productIndex === -1) {
                // If product is not in the cart, add it as a new entry
                userCart.products.push({
                    productId: productId,
                    quantity: quantity,
                    totalPrice: quantity * productPrice
                });
            } else {
                // If product is in the cart, update the quantity and total price
                userCart.products[productIndex].quantity += quantity;
                userCart.products[productIndex].totalPrice += quantity * productPrice;
            }

            await userCart.save();
        }

        res.json({ message: 'Product added to cart successfully' });
    } catch (err) {
        console.error(err);
        res.json({ error: 'Internal server error' });
    }
};


const removeFromCart = async (req, res) => {
    try {
        const productid = req.params.id; 
        const result = await Cart.updateOne(
            { "products.productId": productid },
            { $pull: { products: { productId: productid } } }
        )
        

        if(result.deletedCount > 0){
            res.json({message: "Product removed from cart successfully" });
        }else{
            res.json({ error: "Product not found in cart" });
        }    
    } catch (err) {
        console.error(err);
        res.json({error: "Internal server error" });
    }
}


         
const updateCart = async (req, res) => {
    try {
        const productId = req.params.id;
        const newQuantity = req.params.newQuantity;
        const userCart = await Cart.findOne({ userid: req.session.user });

        const cartProduct = userCart.products.find(p => p.productId.equals(productId));
        const productToCart = await Product.findById(productId).populate({
            path: 'Category',
            populate: { path: 'offer' }
        }).populate('offer');



        let productPrice;
        if (productToCart.offer) {
            productPrice = Math.floor(productToCart.Price - (productToCart.Price * productToCart.offer.percentage / 100));
        } else if (productToCart.Category.offer) {
            productPrice = Math.floor(productToCart.Price - (productToCart.Price * productToCart.Category.offer.percentage / 100));
        } else {
            productPrice = productToCart.Price;
        }

        cartProduct.quantity = newQuantity;
        cartProduct.totalPrice = newQuantity * productPrice;
        const productprice=newQuantity * productPrice;
        await userCart.save();
        const totalPrice = userCart.products.reduce((total, product) => {
            return total + product.totalPrice;
        }, 0);
        subtotal = totalPrice
        let shipping = 50
        totalPrice = totalPrice+shipping
        res.json({success:true, cart: userCart, productprice ,subtotal, totalPrice}); 
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const checkout = async (req,res)=>{
    try{
        const userid = req.session.user
        const user = await User.findById(userid)
        const cartData = await Cart.findOne({userid:userid}).populate({
            path:"products.productId",
            model:"Products"
        })
        let totalPrice = cartData.products.reduce((total, product) => {
            return total + product.totalPrice;
        }, 0);
        subtotal = totalPrice
        let shipping = 50
        totalPrice = totalPrice+shipping 
        res.render('checkout',{user,cartData,totalPrice,subtotal})
    }catch(err){
        console.log(err);
    }
}




const addressSubmit = async(req,res)=>{
    try{
        const {name,phone,email,address,pincode,state,city} = req.body
        console.log(req.body)
        const userid = req.session.user
        const user = await User.findById(userid)
        
        user.Addresses.push({
            name,
            email,
            phone,
            address,
            pincode,
            state,
            city
        })
        const updatedUser = await user.save()        
        res.redirect('/checkout')
    }catch(err){
        console.log(err)
        res.send('Internal Server Error');

    }
}


module.exports={
    cart,
    addToCart,
    removeFromCart,
    updateCart,
    checkout,
    addressSubmit
}