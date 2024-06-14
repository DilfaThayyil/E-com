const express=require('express')
const app=express()
const Product=require('../model/products')
const Category=require('../model/category')
const User=require('../model/userSchema')
const path=require('path')
const multer=require('multer')
const fs = require('fs')
const Order = require('../model/orderSchema')
require('dotenv').config()
const Coupon = require('../model/couponSchema')
const offer = require('../model/offerSchema')
const {adminEmail,adminPassword} = process.env



const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "public/uploads");
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + "-" + file.originalname);
    },
  });
  
const upload = multer({ storage: storage }).array("images", 4);
  
  
app.use(express.static(path.join(__dirname, "public")));




const login = (req,res)=>{
    try{
        let msg=req.flash('err')
        res.render('login',{msg})
    }catch(err){
        console.log(err);
    }
}

const loginSubmit = async(req,res)=>{
    try{
        const {email,password} = req.body
        if(email == process.env.adminEmail){
            if(password == process.env.adminPassword){
                req.session.admin = email
                res.redirect('/admin')
            }else{
                let err= "Password is incorrect"
               req.flash('err',err)
               res.redirect('/admin/login')
            }
        }else{
            let err= "email is incorrect"
            req.flash('err',err)
            res.redirect('/admin/login')
        }
    }catch(err){
        console.log(err)
    }
}


const logout = async(req,res)=>{
    try{
        req.session.admin = null
        res.redirect('/admin/login')
    }catch(err){
        console.log(err)
    }
}


const dashboard = async (req, res) => {
    try {


        const totalUsers = await User.countDocuments({});

        const metrics = await Order.aggregate([
            { $unwind: '$products' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products.products',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $match:{
                    'products.Status' : 'delivered'
                }
            },
            {
                $group: {
                    _id: null,
                    overallSalesCount: { $sum: 1 },
                    overallOrderAmount: { $sum: '$products.total' },
                    overallDiscount: {
                        $sum: {
                            $subtract: [
                                { $multiply: ['$productDetails.Price', '$products.quantity'] },
                                '$products.total'
                            ]
                        }
                    }
                }
            }
        ]);


        const categoryQuantities = await Order.aggregate([
            { $unwind: "$products" },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products.products',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: "$productInfo" },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productInfo.Category',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            { $unwind: "$categoryInfo" },
            {
                $group: {
                    _id: "$categoryInfo._id",
                    name: { $first: "$categoryInfo.Name" },
                    totalQuantity: { $sum: "$products.quantity" }
                }
            }
        ]);

        const allCategories = await Category.find({});
        const mergedCategories = allCategories.map(category => {
            const found = categoryQuantities.find(cq => cq._id.toString() === category._id.toString());
            return {
                _id: category._id,
                name: category.Name,
                totalQuantity: found ? found.totalQuantity : 0
            };
        });
        mergedCategories.sort((a, b) => b.totalQuantity - a.totalQuantity);

        const mostSoldProducts = await Order.aggregate([
            { $unwind: "$products" },
            { $group: { _id: "$products.products", totalQuantity: { $sum: "$products.quantity" } } },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 }
        ]);

        const allProducts = await Product.find({});
        const mergedProducts = allProducts.map(product => {
            const found = mostSoldProducts.find(cq => cq._id.toString() === product._id.toString());
            return {
                _id: product._id,
                name: product.Name,
                image: product.Images[0],
                totalQuantity: found ? found.totalQuantity : 0
            };
        });
        mergedProducts.sort((a, b) => b.totalQuantity - a.totalQuantity)
        const top5MergedProducts = mergedProducts.slice(0, 5)

        const yearlySales = await Order.aggregate([
            {
                $match: {
                    'products.Status': 'delivered',
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                    },
                    totalSale: { $sum: '$total' },
                    totalOrders: { $sum: 1 },
                },
            },
            {
                $sort: {
                    '_id.year': 1,
                },
            },
        ]);


        const weeklySales = await Order.aggregate([
            {
                $match: {
                    'products.Status': 'delivered',
                },
            },
            {
                $group: {
                    _id: {
                        week: { $week: '$date' },
                        year: { $year: '$date' },
                    },
                    totalSale: { $sum: '$total' },
                    totalOrders: { $sum: 1 },
                },
            },
            {
                $sort: {
                    '_id.year': 1,
                    '_id.week': 1,
                },
            },
        ]);

        const ordersData = await Order.find(); 
        const monthlyData = transformDataForBarGraph(ordersData);


        const yearlyData = {
            labels: yearlySales.map(sale => String(sale._id.year).slice(-2)),
            data: yearlySales.map(sale => sale.totalSale)
        };
        let week=[1,2,3,4]

        const weeklyData = {
            labels:week,
            data: weeklySales.map(sale => sale.totalSale)
        };

        const monthlyDataForFrontend = {
            labels: monthlyData.map(data => data.month),
            data: monthlyData.map(data => data.sales)
        };

        console.log(yearlyData.data)

        res.render('dashboard', {
            mostSoldProducts,
            top5MergedProducts,
            mergedProducts,
            mergedCategories,
            metrics,
            totalUsers,
            yearlyData,
            weeklyData,
            monthlyData: monthlyDataForFrontend,
            ordersData
        });
    } catch (err) {
        console.log(err);
    }
};

function transformDataForBarGraph(ordersData) {
    const monthlyData = Array.from({ length: 12 }, (_, index) => ({
        month: getMonthName(index),
        sales: 0,
        orders: 0
    }));

    ordersData.forEach(order => {
        const month = new Date(order.date).getMonth();

        const deliveredProducts = order.products.filter(product => product.Status === 'delivered');

        monthlyData[month].sales += deliveredProducts.reduce((total, product) => total + product.total, 0);
        monthlyData[month].orders += deliveredProducts.length;
    });

    return monthlyData;
}


function getMonthName(monthIndex) {
    const months = [
       'J',"F","M","A","M","J"
    ];
    return months[monthIndex];
}





const allProducts = async (req, res) => {
    try {
        const admin = req.session.admin;
        const perPage = 5;
        const page = parseInt(req.query.page) || 1;
        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts / perPage);
        const offers = await offer.find()
  
        const products = await Product.find()
            .populate({
                path:"Category",
                model:"Category"
            })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .exec();
  
        const successMessage = req.flash('success');
        res.render('allproducts', { products, admin, totalPages, currentPage: page , message: successMessage , offers});
    } catch (err) {
        console.error(err);
        res.send('Internal Server Error');
    }
  };
  



const allUsers = async(req,res)=>{
    try{
        const perPage = 5; 
      const page = parseInt(req.query.page) || 1; 

      const totalUsers = await User.countDocuments();
      const totalPages = Math.ceil(totalUsers / perPage);

        const users = await User.find()
        .skip((page - 1) * perPage)
        .limit(perPage)
        .exec();
        res.render('allusers',{users,totalPages,currentPage:page})
    }catch(err){
        console.log(err);
    }
}

const category = async(req,res)=>{
    try{
        const category = await Category.find()
       const offers = await offer.find()
        res.render('category',{category,offers})
    }catch(err){
        console.log(err);
    }
}

const allOrders = async(req,res)=>{
    try{
    
      const perPage = 4; 
      const page = parseInt(req.query.page) || 1; 

      const totalOrders = await Order.countDocuments();
      const totalPages = Math.ceil(totalOrders / perPage);

      const orders = await Order.find()
          .populate({
              path: 'products.products',
              model: 'Products',
            })
          .populate({
                path: "userid",
                model: "User"
            })    
          .sort({date:-1})
          .skip((page - 1) * perPage)
          .limit(perPage)
          .exec();

      res.render('allorders', { orders, totalPages, currentPage: page });
  } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
  }
}


    const orderDetails=async(req,res)=>{
        try{
            const { orderId, productId } = req.params;
            const order = await Order.findById(orderId).populate('userid')
            if (!order) {
                return res.json({ message: 'Order not found' });
            }
            const product = order.products.find(prod => prod.products.equals(productId));
            if (!product) {
                return res.status(404).json({ message: 'Product not found in order' });
            }
            const user = await User.findById(order.userid);
            const productDetails = await Product.findById(productId);
            console.log("order : ",order);
            res.render('orderDetails', {order,product,user,productDetails}); 
        } catch (error) {
            console.error('Error fetching order details:', error);
        }
    }



const cancelOrder = async (req, res) => {
    const orderId = req.params.orderId;
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        order.products.forEach(product => {
            if (product.Status !== 'cancelled') {
                product.Status = 'cancelled';
            }
        });
        await order.save();
        res.status(200).json({ message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


const approveReturnRequest = async (req, res) => {
    const { orderId, productId } = req.params;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const product = order.products.find(p => p._id.equals(productId));
        if (!product) {
            return res.status(404).json({ message: 'Product not found in order' });
        }
        product.Status = 'returned';
        await order.save();
        
        const updatequantity=await Product.findById(product.products)
        updatequantity.Quantity+=product.quantity
        await updatequantity.save()

        const user = await User.findById(order.userid)
        const refundAmount = product.total
        user.wallet += refundAmount
        const transaction = {
            amount : refundAmount,
            description : 'Product returned',
            date : new Date(),
            status : 'in'
        }
        user.walletHistory.push(transaction)
        await user.save()


        res.status(200).json({ success: true, message: 'Return request approved successfully' });
    } catch (error) {
        console.error('Error approving return request:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};




const editProduct = async(req,res)=>{
    try{
        const productId = req.params.id
        const product = await Product.findById(productId).populate('Category').exec()
        const category = await Category.find({Status:'active'})
        res.render('editProduct',{product,category})
    }catch(err){
        console.log(err)
    }
}





const editProductSubmit = async (req, res) => {
    try{
        upload(req, res, async function (err) {
          if (err) {
            const errorMsg = "Image more than 4 is not allowed";
            req.flash("err", errorMsg);
            res.redirect("/admin/editproduct");
          } else {
    
    
        const productId = req.params.id;
        const updatedData = {
          Name: req.body.name,
          Description: req.body.description,
          Quantity: req.body.quantity,
          Price: req.body.price,
          DiscountPrice: req.body.discountPrice,
          Category:req.body.category,
       
        };
        
        Object.keys(updatedData).forEach(
          (key) => updatedData[key] == "" && delete updatedData[key]
        );
        const product = await Product.updateOne({ _id: productId }, updatedData);
        if (product) {
            req.flash('success','product edited successfully')
            res.redirect("/admin/allproducts");
        }
        }
      })
      }catch(err){
        console.log(err);
      }
    }
    


const addProducts = async(req,res)=>{
    try{
        const msg = req.flash('err')
        const category =await Category.find()
        res.render('addproducts',{category,msg})
    }catch(err){
        console.log(err);
    }
}

const addProductsSubmit = async(req,res)=>{
    try{
        upload(req, res, async function (err) {
            if (err) {
              const errorMsg = "Image more than 4 is not allowed";
              req.flash("err", errorMsg);
              return res.redirect("/admin/addproducts");
            }
         const {productname,categoryname,price,discountPrice,quantity,description} = req.body
        const checking= await Product.findOne({Name:productname})
        if(checking){
            const message="product name already exists"
            req.flash('err',message)
            res.redirect('/admin/addproducts')
        }else{
            const product=new Product({
                Name:productname,
                Description:description,
                Price:price,
                Category:categoryname,
                Quantity:quantity,
                DiscountPrice:discountPrice,
                Images: req.files.map((file) => file.filename),
                
            })
            await product.save()
            req.flash('success', 'Product added successfully');
            res.redirect('/admin/allproducts')
        }
    });
    }catch(err){
        console.log(err);
    }
}

const addCategory = async(req,res)=>{
    try{
        res.render('addcategory')
    }catch(err){
        console.log(err);
    }
}

const addCategorySubmit = async(req,res)=>{
    try{
        const {name,description} = req.body
        const check = await Category.findOne({Name:name})
        if(check){
            const message="category already exists"
            req.flash('error',message)
            return res.redirect('/admin/addcategory')
        }else{
            const category=new Category({
                Name:name,
                Description:description
            })
            await category.save()
            res.redirect('/admin/category')
        }
    }catch(err){
        console.log(err);
    }
}

const deleteCategory = async(req,res)=>{
    try{
        const categoryId = req.params.id
        const deleteCategory = await Category.deleteOne({_id:categoryId})
        res.json({success:"deleted"})
    }catch(err){
        console.log(err);
    }
}

const blockUser = async (req,res)=>{
    try{
        const userId = req.params.id
        const blockUser = await User.findById(userId)
        if(blockUser){
            blockUser.isBlocked=true
            await blockUser.save()
            res.redirect('/admin/allusers')
        }else{
            res.redirect('/admin/allusers')
        }
    }catch(err){
        console.log(err);
    }
}

const unBlockUser = async(req,res)=>{
    try{
        const userId = req.params.id
        const unBlockUser = await User.findById(userId)
        if(unBlockUser){
            unBlockUser.isBlocked=false
            await unBlockUser.save()
            res.redirect('/admin/allusers')
        }else{
            res.redirect('/admin/allusers')
        }
    }catch(err){
        console.log(err);
    }
}

const blockProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const blockproduct = await Product.findById(productId);
        if (blockproduct) {
            blockproduct.Status = 'blocked';
            await blockproduct.save();
            req.flash('success', 'Product blocked successfully');
        } else {
            req.flash('error', 'Product not found');
        }
        res.redirect('/admin/allproducts');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error blocking product');
        res.redirect('/admin/allproducts');
    }
};

const unBlockProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const unblockproduct = await Product.findById(productId);
        if (unblockproduct) {
            unblockproduct.Status = 'active';
            await unblockproduct.save();
            req.flash('success', 'Product unblocked successfully');
        } else {
            req.flash('error', 'Product not found');
        }
        res.redirect('/admin/allproducts');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error unblocking product');
        res.redirect('/admin/allproducts');
    }
};


const blockCategory = async (req, res) => {
    try {
        const categoryId = req.body.categoryId; 
        const action = req.body.action; 
        const check = await Category.findById(categoryId);
        if (check) {
          
            check.Status = action === 'block' ? 'blocked' : 'active';
            await check.save();
            res.json({ success: true });
        } else {
            res.json({ success: false }); 
        }
    } catch (err) {
        console.log(err);
    }
};


const editCategory= async (req,res)=>{
    try{
      const category_id=req.params.id
      const category  = await Category.findOne({_id:category_id})
      const err=req.flash('error')
      res.render('editcategory',{category,err })
    }catch(err){
      console.log(err);
    }
   }


   const editCategorySubmit= async(req,res)=>{
    try{

      const category_id= req.params.id
     const updatecategory= await Category.findOne({_id:category_id})
        
     const existingCategory = await Category.findOne({Name:req.body.name });
     if (existingCategory && existingCategory._id.toString() !== category_id) {
         req.flash('error', 'Category name already exists');
         return res.redirect('/admin/editcategory/' + category_id); 
     }

      if(updatecategory){
      await Category.findByIdAndUpdate({_id:category_id},{
        Name:req.body.name,
        Description:req.body.description
      })
     }else{
      res.redirect('/admin/category')
     }
     res.redirect('/admin/category')
    }catch(err){
      console.log(err);
    }
   }


   
const imagedelete = async (req, res) => {
    try {
  
    const imgid = req.params.imgid;
    const index = req.params.index;
    const productid = req.params.proid;
    const imagePath = path.join('public', 'uploads', imgid);
  
    const product = await Product.findOne({ _id: productid });
  
    if (!product) {
        return res.status(404).send('Product not found');
      }
  
      if (product.Images.length <= 1) {
        return res.status(400).send('Cannot delete the last image.');
      }
  
      await fs.promises.unlink(imagePath);
  
      product.Images.splice(index, 1);
  
      await product.save();
  
      res.status(200).send('Image deleted successfully');
    } catch (err) {
      console.error('Error deleting image:', err);
      res.status(500).send('Internal Server Error');
    }
  };


  const updateStatus = async(req,res)=>{
    try{
        const { status, orderId, productId } = req.body
        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const product = order.products.find(prod => prod.products._id.toString() === productId);

        if (!product) {
            return res.status(404).json({ error: 'Product not found in order' });
        }
        
        product.Status = status;
        await order.save();

        return res.status(200).json({ message: 'Status updated successfully', order });

        

    }catch(err){
        console.log(err);
    }
  }


    const coupon = async(req,res)=>{
        try{
            const perPage = 5
            const page = parseInt(req.query.page) || 1
            const totalCoupons = await Coupon.countDocuments()
            const totalPages = Math.ceil(totalCoupons / perPage)
            const coupons = await Coupon.find()
            .skip((page - 1) * perPage)
            .limit(perPage)
            .exec();
            const successMessage = req.flash('success')
            res.render('coupons',{coupons,message:successMessage,totalPages,currentPage: page})
        }catch(err){
            console.log(err)
        }
  }


    const addCoupons = async(req,res)=>{
        try{
            const msg = req.flash('err')
            res.render('addCoupons',{msg})
        }catch(err){
            console.log(err)
        }   
    }

  
    const addCouponSubmit = async(req,res)=>{
        try{
            const {couponName,couponCode,discountAmount,MinAmount,couponDescription,exprDate} = req.body
            console.log(req.body)
            const check = await Coupon.findOne({name:couponName})
            if(check){
                const message = "Coupon name already exists"
                req.flash('err',message)
                return res.redirect('/admin/addCoupons')
            }
            if (Number(MinAmount) <= Number(discountAmount)) {
                const message = "Minimum amount should be greater than discount amount";
                req.flash('err', message);
                return res.redirect('/admin/addCoupons');
            }
                const coupon = new Coupon({
                    name:couponName,
                    code:couponCode,
                    discountAmount:discountAmount,
                    minAmount:MinAmount,
                    description:couponDescription,
                    expiryDate:exprDate
                })
                await coupon.save()
                req.flash('success','Coupon added successfully')
                res.redirect('/admin/coupon')
            
        }catch(err){
            console.log(err)
        }
    }



    const blockCoupon =async(req,res)=>{
        try{
            const couponId = req.body.couponId
            const action = req.body.action
            const check = await Coupon.findById(couponId)
            if(check){
                check.status = action === 'block' ? false : true;
                await check.save()
                res.json({success:true})
            }else{
                res.json({success:false})
            }
        }catch(err){
            console.log(err)
        }
    }

    const deleteCoupon = async(req,res)=>{
        try{
            const couponId = req.params.id
            const deleteCoupon = await Coupon.deleteOne({_id:couponId})
            res.json({success:"deleted"})
        }catch(err){
            console.log(err)
        }
    }


    const editCoupon = async(req,res)=>{
        try{
            const couponId = req.params.id
            const coupon = await Coupon.findById(couponId)
            res.render('editcoupon',{coupon})
        }catch(err){
            console.log(err)
        }
    }
    

    const editCouponSubmit = async (req,res)=>{
        try{
            const couponId = req.params.id
            const updatedCoupon = await Coupon.findById(couponId)
            const existingCoupon = await Coupon.findOne({name:req.body.name });
            if (existingCoupon && existingCoupon._id.toString() !== couponId) {
            req.flash('error', 'Coupon name already exists');
            return res.redirect('/admin/editCoupon/' + couponId); 
            }
           
            if(updatedCoupon){
                await Coupon.findByIdAndUpdate({_id:couponId},{
                name: req.body.name,
                code: req.body.code,
                discountAmount: req.body.discount,
                minAmount: req.body.minimum,
                description: req.body.description,
                expiryDate: req.body.date,
                })
            }else{
                res.redirect('/admin/coupon')
            }
            res.redirect('/admin/coupon')
        }catch(err){
            console.log(err)
        }
    }
  

    


    const salesReport = async(req,res)=>{
        try{
            res.render('salesReport')
        }catch(err){
            console.log(err)
        }
    }


    const salesReportGenerate = async(req,res)=>{
        try{
            const { period, startDate, endDate } = req.body;
            let startDateTime, endDateTime;

            switch (period) {
            case 'daily':
                startDateTime = new Date();
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date();
                endDateTime.setHours(23, 59, 59, 999);
                break;

            case 'weekly':
                startDateTime = new Date();
                startDateTime.setDate(startDateTime.getDate() - startDateTime.getDay());
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date();
                endDateTime.setDate(startDateTime.getDate() + 6);
                endDateTime.setHours(23, 59, 59, 999);
                break;

            case 'monthly':
                startDateTime = new Date();
                startDateTime.setDate(1);
                startDateTime.setHours(0, 0, 0, 0);
                endDateTime = new Date();
                endDateTime.setMonth(endDateTime.getMonth() + 1);
                endDateTime.setDate(0);
                endDateTime.setHours(23, 59, 59, 999);
                break;

            case 'custom':
                if (!startDate || !endDate) {
                    return res.status(400).json({ error: 'Start date and end date are required for custom period' });
                }
                startDateTime = new Date(`${startDate}T00:00:00.000Z`);
                endDateTime = new Date(`${endDate}T23:59:59.999Z`);
                break;

            default:
                return res.status(400).json({ error: 'Invalid period specified' });
        }

        console.log(`Generating report from ${startDateTime} to ${endDateTime}`);

            const orders = await Order.aggregate([
                {
                    $match: {
                        date: { $gte: startDateTime, $lte: endDateTime },
                        'products.Status': 'delivered' 
                    },
                },
                {
                    $lookup: {
                        from: 'users', 
                        localField: 'userid',
                        foreignField: '_id',
                        as: 'user',
                    },
                },
                {
                    $unwind: '$user',
                },
                {
                    $unwind: '$products',
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'products.products',
                        foreignField: '_id',
                        as: 'products.productInfo',
                    },
                },
                {
                    $unwind: '$products.productInfo',
                },
                {
                    $group: {
                        _id: '$_id',
                        userid: { $first: '$user' },
                        products: {
                            $push: {
                                name: '$products.productInfo.Name',
                                price: '$products.productInfo.Price',
                                discountPrice: '$products.productInfo.DiscountPrice',
                                status: '$products.Status',
                                quantity: '$products.quantity',
                                total: '$products.total'
                            }
                        },
                        total: { $sum: '$products.total' },
                        date: { $first: '$date' },
                    },
                },
            ])

            console.log("Orders Count:", orders.length);
            console.log("Start Date:", startDateTime);
            console.log("End Date:", endDateTime);

            return res.json({
                status: "success",
                data: {
                    orders,
                    startDate: startDateTime,
                    endDate: endDateTime,
                },
            });
        } catch (error) {
            console.error('Error generating sales report:', error);
            res.status(500).send({ error: 'Internal Server Error' });
        }
    }


    const allOffers = async(req,res)=>{
        try{
            const message = ''
            const offers = await offer.find()
            res.render('allOffers',{offers,message})
        }catch(err){
            console.log(err)
        }
    }


    const addOffer = async(req,res)=>{
        try{
            res.render('addOffers')
        }catch(err){
            console.log(err)
        }
    }


    const addOfferSubmit = async(req,res)=>{
        try{
            const {name,startingDate,endDate,percentage}=req.body
            const already=await offer.findOne({name:name})
            if(already){
              const message="Offer is already exists"
              req.flash('msg',message)
              res.redirect('/admin/addOffer')
            }
            const newOffer = new offer({
              name:name,
              startDate:startingDate,
              endDate:endDate,
              percentage:percentage
            })
            await newOffer.save()
            res.redirect('/admin/offer')
          }catch(err){
            console.log(err);
          }
    }


    const editOffer = async(req,res)=>{
        try{
            const offerId = req.params.id
            const offers = await offer.findById(offerId)
            res.render('editOffers',{offers})
        }catch(err){
            console.log(err)
        }
    }


    const editOfferSubmit = async(req,res)=>{
        try{
            const offerId = req.params.id
            const {name,startingDate,endDate,percentage} = req.body
    
            const existingOffer = await offer.findOne({
            name: name,
            _id: { $ne: offerId }
            });
            if (existingOffer) {
            const message="An offer with the same name already exists."
            req.flash('msg',message)
            return res.redirect('/admin/offer')
            }
            const update = await offer.findByIdAndUpdate(
                { _id: offerId },
                {
                    name:name,
                    startDate:startingDate,
                    endDate:endDate,
                    percentage:percentage
                }
            );

            res.redirect('/admin/offer');

        }catch(err){
            console.log(err)
        }
    }


    const applyOffer = async(req,res)=>{
        try{
            const {offerId,productId} = req.body            
            const product = await Product.findOneAndUpdate(
                {_id:productId},
                {offer:offerId},
                {new:true}
            ).populate('offer')
            res.json({success:true,product})
        }catch(err){
            console.log(err)
        }
    }


    const removeOffer = async(req,res)=>{
        try{
            const {offerId,productId} = req.body
            const product = await Product.findByIdAndUpdate(
                {_id:productId},
                {offer:null}
            )
            await product.save()
            res.json({success:'true'})
        }catch(err){
            console.log(err)
        }
    }


    const applyOfferCategory = async(req,res)=>{
        try{
            const {offerId,categoryId} = req.body
            const category = await Category.findOneAndUpdate(
                {_id:categoryId},
                {offer:offerId},
                {new:true}
            ).populate('offer')
            res.json({success:true,category})
        }catch(err){
            console.log(err)
        }
    }


    const removeOfferCategory = async(req,res)=>{
        try{
            const {offerId,categoryId} = req.body
            const category = await Category.findByIdAndUpdate(
                {_id:categoryId},
                {offer:null}
            )
            await category.save()
            res.json({success:true})
        }catch(err){
            console.log(err)
        }
    }


    module.exports = {
    dashboard,
    login,
    logout,
    allProducts,
    allUsers,
    category,
    allOrders,
    addProducts,
    addProductsSubmit,
    editProduct,
    editProductSubmit,
    addCategory,
    addCategorySubmit,
    deleteCategory,
    blockUser,
    unBlockUser,
    blockProduct,
    unBlockProduct,
    blockCategory,
    editCategory,
    editCategorySubmit,
    imagedelete,
    loginSubmit,
    cancelOrder,
    updateStatus,
    orderDetails,
    approveReturnRequest,
    coupon,
    addCoupons,
    addCouponSubmit,
    blockCoupon,
    deleteCoupon,
    editCoupon,
    editCouponSubmit,
    salesReport,
    salesReportGenerate,
    allOffers,
    addOffer,
    addOfferSubmit,
    editOffer,
    editOfferSubmit,
    applyOffer,
    removeOffer,
    applyOfferCategory,
    removeOfferCategory
    }