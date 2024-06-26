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
const {KEY_ID,KEY_SECRET} = process.env
const crypto = require('crypto')
const easyinvoice = require('easyinvoice');
const { name } = require('ejs')
const fs = require('fs');
const path = require('path');






const instance = new Razorpay({
  key_id:KEY_ID,
  key_secret:KEY_SECRET
})


const generateRazorpay =(orderId , adjustedAmount)=>{
  return new Promise((resolve,reject)=>{
    const options = {
      amount:adjustedAmount,
      currency:"INR",
      receipt:""+orderId
    }
    instance.orders.create(options,function(err,order){
      if(err){
        reject(err)
      }else{
        resolve(order)
      }
    })
  })
}




const placeOrder = async (req, res) => {
    try {
        const userid = req.session.user
        const { selectedValue,total,couponid ,paymentMethod} = req.body;
        
        
        if(couponid){
          const coupon = await Coupon.findOne({code:couponid})
          if(coupon){
            coupon.usedUser.push({user_id:userid})
            await coupon.save()
          }
        }

        const cartData = await Cart.findOne({userid:userid}).populate({
            path:"products.productId",
            model:"Products"
        })

        const products = await Promise.all(cartData.products.map(async (cartProduct) => {
            const productDetails = await Product.findById(cartProduct.productId);
            productDetails.Quantity -= cartProduct.quantity;
            await productDetails.save();
            return {
                products: cartProduct.productId,
                name: productDetails.Name,
                price: productDetails.Price,
                quantity: cartProduct.quantity,
                total: cartProduct.totalPrice,
                orderStatus: cartProduct.status,
                image:cartProduct.image,
                reason: cartProduct.cancellationReason,
            };
        }));

        const newOrder = new Order({
          userid: userid,
          address: selectedValue,
          total: total,
          date: new Date(),
          products: products,
          status: 'placed',
          paymentMode:paymentMethod
      })

      if(paymentMethod === 'wallet'){
        newOrder.products.forEach(product => {
          product.Status = 'placed';
        });
        newOrder.paymentStatus='wallet'
        await newOrder.save().then(async()=>{
          await Cart.deleteOne({userid:userid})
          res.json({ success: true, order: newOrder });
        })
        const user = await User.findOne({_id:userid})
        user.wallet=user.wallet-total
        const transaction = {
          amount : total,
          description: 'Product purchased',
          date : new Date(),
          status : 'out'
        }
        user.walletHistory.push(transaction)
        await user.save()

      }
      
      if(paymentMethod === 'Cash on delivery'){
        newOrder.products.forEach(product => {
          product.Status = 'placed';
        });
        newOrder.paymentStatus="COD"
        await newOrder.save()
        await Cart.deleteOne({userid:userid})
        res.json({ success: true, order: newOrder });

      } else if (paymentMethod === 'Razorpay') {
        const totalPrice = Math.round(newOrder.total * 100);
        const minimumAmount = 100;
        const adjustedAmount = Math.max(totalPrice, minimumAmount);
  
        await newOrder.save()
       
        generateRazorpay(newOrder._id,adjustedAmount).then((response)=>{
          res.json({ Razorpay: response ,order: newOrder });
        }).catch(async (error) => {
          console.error('Razorpay payment failed:', error);
          res.json({ success: false, error: 'Payment failed, please retry.', order: newOrder });
        });
      }
    } catch (error) {
      console.error('Error placing order:', error);
      res.status(500).json({ success: false, error: 'An error occurred while placing the order.' });
    }
};



const verifyPayment = async(req,res)=>{
  try{
    const userId = req.session.user
    const {payment,order} = req.body
    const userOrder=await Order.findById(order._id)
    let hmac= crypto.createHmac('sha256','XEwHXRnbP4kAiT17e5nWBbLk')
    hmac.update(payment.razorpay_order_id+'|'+payment.razorpay_payment_id)
    hmac=hmac.digest('hex')
    if(hmac===payment.razorpay_signature){
      userOrder.paymentStatus="Razorpay"
      userOrder.products.forEach((product)=>{
        product.Status = "placed"
      })
      await userOrder.save()        
      await Cart.deleteOne({userid:userId})
      res.json({ payment: true, orderId: userOrder._id });  // Change: Sending orderId in response
    } else {
      res.json({ payment: false });
    }
   
  }catch(err){
  console.log(err);
  }
}



const verifyPaymentFailed = async (req, res) => {
  try {
      const { order } = req.body;
      const userOrder = await Order.findById(order._id);

      if (userOrder) {
          userOrder.paymentStatus = "pending";
          await userOrder.save();
          res.json({ success: true });
      } else {
          res.status(404).json({ success: false, error: 'Order not found.' });
      }
  } catch (err) {
      console.log(err);
      res.status(500).json({ success: false, error: 'An error occurred while updating the payment status.' });
  }
};





const viewOrder = async(req,res)=>{
    try{
        const userid = req.session.user
        const user = await User.findById(userid)
        const orderId = req.params.id
        const order = await Order.findById(orderId).populate({
            path:"products.products",
            model:"Products",
            populate:{
                path:"Category",
                model:"Category"
            }
        })
        res.render('viewOrder',{user:user,order:order})
    }catch(err){
        console.log(err)
    }
}




const cancelOrder = async(req,res)=>{
    try{
        const userid = req.session.user
        const {productid,orderid} = req.params
        const user = await User.findById(userid)
        const order=await Order.findById(orderid)
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        let cancelProduct = order.products.find(product=>
            product.products.toString() === productid
        )
        if (!cancelProduct) {
            return res.json({ success: false, message: 'Product not found in order' });
        }
        cancelProduct.Status='cancelled'
        await order.save()
        const product = await Product.findById(productid)
        if (!product) {
            return res.json({ success: false, message: 'Product not found' });
        }
        product.Quantity += cancelProduct.quantity
        await product.save()

        const refundAmount = cancelProduct.total
        if(order.paymentMode === 'Razorpay' || order.paymentMode === 'wallet'){
          user.wallet += refundAmount
          const transaction = {
            amount : refundAmount,
            description : 'Product cancellation',
            date : new Date(),
            status : 'in'
          }
          user.walletHistory.push(transaction)
          await user.save()
        }
        res.json({success: true,message: 'Product cancelled successfully'});
    }catch(err){
        console.log(err)
    }
}


  



const returnRequest = async (req, res) => {
    const { orderid, productid } = req.params;
    const { reason } = req.body; 

  
    try {
        const updatedOrder = await Order.findOne({_id:orderid});
        const orderproduct = updatedOrder.products.find(p => p.products.equals(productid));

        orderproduct.Status='request return'
        orderproduct.reason=reason
        await updatedOrder.save()
        

          res.json({
            success: true,
            message: 'Product return requested successfully',
            updatedOrder,
        });
    } catch (error) {
        console.error('Error requesting product return:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const { couponCode, checkprice } = req.body;
    
    const coupon = await Coupon.findOne({ code: couponCode });
    
    if (!coupon) {
      return res.json({ error: 'Coupon not found' });
    }
    
    const alreadyUsed = coupon.usedUser.some((user) => user.userid.toString() === userId);
    if (alreadyUsed) {
      return res.json({ already: 'Coupon already used by this user' });
    }
    
    if (coupon.minAmount > checkprice) {
      return res.json({ minimum: `Coupon not added. Minimum purchase ₹${coupon.minAmount}` });
    }
    
    const currentDate = new Date();
    if (coupon.expiryDate <= currentDate) {
      return res.json({ already: 'Coupon date expired' });
    }

    const cartData = await Cart.findOne({ userid: userId }).populate({
      path: 'products.productId',
      model: 'Products'
    });

    const totalPriceTotal = cartData.products.reduce((total, product) => total + product.totalPrice, 0);

    const maxDiscount = totalPriceTotal * 0.10;
    
    const appliedDiscount = Math.min(coupon.discountAmount, maxDiscount);
    
    const discountedPrice = totalPriceTotal - appliedDiscount;

    if (discountedPrice < 10) {
      return res.json({ error: 'Coupon cannot be applied as it reduces the order price below ₹10' });
    }

    
    res.json({ 
      success: `Coupon ${coupon.name} applied successfully`, 
      totalPriceTotal, 
      discountedPrice, 
      appliedDiscount, 
      couponid: coupon._id 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const invoiceDownload = async(req, res) => {
  try {
    const orderId = req.params.id
    const oorder = await Order.findById(orderId).populate({
      path:"products.products",
      model:"Products",
      populate: [
        { path: 'offer' },
        { 
            path: 'Category',
            populate: { path: 'offer' }
        }
    ]
  })
    res.render('invoice',{oorder})
  } catch (err) {
      console.log(err);
  }
};


const retryPayment = async (req, res) => {
  try {
    const userid = req.session.user
    const { orderId, paymentOption , productId } = req.body;

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }


    const pendingProduct = order.products.find(product => 
      product.products.toString() === productId && product.Status === 'pending'
    );
    
    if (!pendingProduct) {
      return res.status(400).json({ success: false, message: 'Pending product not found or already processed.' });
    }
    pendingProduct.Status = 'placed';


    if (paymentOption === 'wallet') {
      order.paymentStatus = 'wallet'
      order.paymentMode = 'wallet';

      const user = await User.findById(userid);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      user.wallet -= order.total;
        const transaction = {
          amount : order.total,
          description: 'Product purchased (Retry Payment)',
          date : new Date(),
          status : 'out'
        }
        user.walletHistory.push(transaction)
        await user.save()
        res.json({success:true, order:order})
    } 
    
    if(paymentOption === 'cod'){
      order.paymentStatus = 'COD';
      order.paymentMode = 'COD';
      res.json({success:true,order:order})

    } else if (paymentOption === 'razorpay') {
      const totalPrice = Math.round(order.total*100)
        const minimumAmount = 100
        const adjustedAmount = Math.max(totalPrice,minimumAmount)
        generateRazorpay(order._id,adjustedAmount).then(async(response)=>{
          order.paymentStatus = 'Razorpay';
        order.paymentMode = 'Razorpay';

        await order.save();
        return res.json({ Razorpay: response, order: order });
        })

    }
  } catch (err) {
    console.log(err);
  }
};





module.exports={
    placeOrder,
    viewOrder,
    cancelOrder,
    returnRequest,
    applyCoupon,
    generateRazorpay,
    verifyPayment,
    invoiceDownload,
    retryPayment,
    verifyPaymentFailed
}