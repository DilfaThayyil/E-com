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
const easyinvoice = require('easyinvoice');






const instance = new Razorpay({
  key_id:key_id,
  key_secret:key_secret
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
        const { selectedValue, total ,couponid ,paymentMethod} = req.body;
        
        console.log(req.body)

        
        if(couponid){
          const coupon = await Coupon.findOne({code:couponid})
          console.log(coupon)
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
        newOrder.paymentStatus='wallet'
        await newOrder.save()
        const orderSaved = await newOrder.save().then(async()=>{
          await Cart.deleteOne({userid:userid})
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
        newOrder.paymentStatus="COD"
        await newOrder.save()
        await Cart.deleteOne({userid:userid})
        res.json({ success: true, order: newOrder });

      }else if(paymentMethod === 'Razorpay'){
        const totalPrice = Math.round(newOrder.total*100)
        const minimumAmount = 100
        const adjustedAmount = Math.max(totalPrice,minimumAmount)
        generateRazorpay(newOrder._id,adjustedAmount).then(async(response)=>{
          await newOrder.save()
          res.json({ Razorpay: response ,order: newOrder });
        })
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
    const orderId = order.receipt
    let hmac= crypto.createHmac('sha256','XEwHXRnbP4kAiT17e5nWBbLk')
    hmac.update(payment.razorpay_order_id+'|'+payment.razorpay_payment_id)
    hmac=hmac.digest('hex')
    if(hmac===payment.razorpay_signature){
       const order = await Order.findById(orderId)
        order.paymentStatus="Razorpay"
        await order.save();
        const cart= await Cart.deleteOne({userid:userId})
        res.json({payment:true})
      }
   
  }catch(err){
  console.log(err);
  }
}




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


const orderSummary= async (req,res)=>{
    try{
  
    const orderid=req.params.id
    const user = await User.findOne({ _id: req.session.user});
    const orders = await Order.find({ _id:orderid})
      .populate({
          path: 'products.products',
          model: 'Products'
      })
      .exec();
  
      res.render("viewOrder",{orders,user,orderid})
  
    }catch(err){
      console.log(err);
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
    console.log(req.body);
    
    const coupon = await Coupon.findOne({ code: couponCode });
    console.log(coupon);
    
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

   console.log(totalPriceTotal, 
    discountedPrice, 
    appliedDiscount, )
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

// const invoiceDownload= async (req,res)=>{
//   try {
//     const orderId = req.params.id;
//     const ordercheck = await Order.findOne({ _id: orderId });

//     if (!ordercheck) {
//         return res.status(404).send('Order not found');
//     }

//     const products = ordercheck.products.map(product => ({
//         quantity: product.quantity,
//         description: product.Description,
//         price: product.total,
//         total: product.total
//     }));
//     const data = {
//         "currency": "USD",
//         "marginTop": 25,
//         "marginRight": 25,
//         "marginLeft": 25,
//         "marginBottom": 25,
//         "logo": "https://www.easyinvoice.cloud/img/logo.png",
//         "sender": {
//             "company": "E-comm"

//         },
//         "client": {
//             "company":ordercheck.address
//         },
//         "invoiceNumber": `INV-${orderId}`, 
//         "invoiceDate": new Date(ordercheck.date).toLocaleDateString('en-US'),
//         "products": products,
//         "bottomNotice": "Kindly pay your invoice within 15 days."
//     };

//     const result = await easyinvoice.createInvoice(data);

//     if (!result.pdf || !result.pdf.length) {
//         throw new Error('Failed to generate PDF document.');
//     }

//     const fileName = `invoice-${orderId}.pdf`;

//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
//     res.setHeader('Content-Length', result.pdf.length);
//     res.send(Buffer.from(result.pdf, 'base64'));
// } catch (err) {
//     console.error(err);
//     res.status(500).send('Internal Server Error');
// }
// }


const invoiceDownload = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findOne({ _id: orderId }).populate({
          path: 'products.products',
          model: 'Products'
        })

        if (!order) {
            return res.status(404).send('Order not found');
        }

        const products = order.products.map(item => ({
            quantity: item.quantity,
            description: item.products.Name,
            price: item.products.Price, 
            total: item.total
        }));

        const data = {
            "documentTitle": "INVOICE",
            "currency": "USD",
            "taxNotation": "vat",
            "marginTop": 25,
            "marginRight": 25,
            "marginLeft": 25,
            "marginBottom": 25,
            "logo": "https://www.easyinvoice.cloud/img/logo.png",
            "sender": {
                "company": "E-comm"
            },
            "client": {
                "company": order.address
            },
            "invoiceNumber": `INV-${orderId}`,
            "invoiceDate": new Date(order.date).toLocaleDateString('en-US'),
            "products": products,
            "bottomNotice": "Kindly pay your invoice within 15 days.",
            "settings": {
                "background": "https://public.easyinvoice.cloud/img/watermark-draft.jpg"
            },
            "translate": {
                "invoiceNumber": "Invoice No",
                "invoiceDate": "Invoice Date",
                "products": "Product",
                "quantity": "Qty",
                "price": "Price",
                "total": "Total"
            }
        };

        const result = await easyinvoice.createInvoice(data);

        if (!result.pdf || !result.pdf.length) {
            throw new Error('Failed to generate PDF document.');
        }

        const fileName = `invoice-${orderId}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Length', result.pdf.length);
        res.send(Buffer.from(result.pdf, 'base64'));
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
}

module.exports={
    placeOrder,
    viewOrder,
    cancelOrder,
    orderSummary,
    returnRequest,
    applyCoupon,
    generateRazorpay,
    verifyPayment,
    invoiceDownload
}