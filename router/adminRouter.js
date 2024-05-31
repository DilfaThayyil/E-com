const express= require('express')
const adminRouter = express()
const adminController = require('../controller/adminController')
const multer=require('multer')
const adminMiddleware = require('../middleware/admin')
adminRouter.set('views','./view/admin')
const Products=require('../model/products')




const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads'); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
    }
  });
  

  const upload = multer({ storage: storage });
  adminRouter.post('/addImage', upload.single('image'), async (req, res) => {
    try {
        const productId = req.body.productId; 
        const product = await Products.findById(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
  
        if (req.file) {
            product.Images.push(req.file.filename);
        } else {
            return res.status(400).json({ error: 'No image file provided' });
        }
  
        await product.save();
  
        res.json({ success: true, message: 'Image added to the product successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  


adminRouter.get('/',adminController.dashboard)
adminRouter.get('/login',adminMiddleware.isLoged,adminController.login)
adminRouter.post('/loginsubmit',adminController.loginSubmit)


adminRouter.get('/allproducts',adminController.allProducts)
adminRouter.get('/addproducts',adminController.addProducts)
adminRouter.post('/addProductsSubmit',adminController.addProductsSubmit)
adminRouter.get('/blockproduct/:id',adminController.blockProduct)
adminRouter.get('/unblockproduct/:id',adminController.unBlockProduct)
adminRouter.get('/editproduct/:id',adminController.editProduct)
adminRouter.post('/editProductSubmit/:id',adminController.editProductSubmit)
adminRouter.post('/deleteimage/:imgid/:index/:proid',adminController.imagedelete)


adminRouter.get('/allusers',adminController.allUsers)
adminRouter.get('/blockuser/:id',adminController.blockUser)
adminRouter.get('/unblockuser/:id',adminController.unBlockUser)


adminRouter.get('/category',adminController.category)
adminRouter.get('/addcategory',adminController.addCategory)
adminRouter.post('/addCategorySubmit',adminController.addCategorySubmit)
adminRouter.post('/blockcategory/',adminController.blockCategory)
adminRouter.get('/editcategory/:id',adminController.editCategory)
adminRouter.post('/editcategorysubmit/:id',adminController.editCategorySubmit)
adminRouter.delete('/deleteCategory/:id',adminController.deleteCategory)


adminRouter.get('/allorders',adminController.allOrders)
adminRouter.post('/cancelOrder/:orderId',adminController.cancelOrder);
adminRouter.post('/updateStatus',adminController.updateStatus)
adminRouter.get('/orderDetails/:orderId/:productId',adminController.orderDetails)
adminRouter.post('/approveReturnRequest/:orderId/:productId',adminController.approveReturnRequest)


adminRouter.get('/coupon',adminController.coupon)
adminRouter.get('/addCoupons',adminController.addCoupons)
adminRouter.post('/addCouponSubmit',adminController.addCouponSubmit)
adminRouter.post('/blockCoupon',adminController.blockCoupon)
adminRouter.get('/editCoupon/:id',adminController.editCoupon)
adminRouter.post('/editCouponSubmit/:id',adminController.editCouponSubmit)
adminRouter.delete('/deleteCoupon/:id',adminController.deleteCoupon)


adminRouter.get('/salesReport',adminController.salesReport)
adminRouter.post('/salesReportGenerate',adminController.salesReportGenerate)


adminRouter.get('/offer',adminController.allOffers)
adminRouter.get('/addOffer',adminController.addOffer)
adminRouter.post('/addOfferSubmit',adminController.addOfferSubmit)
adminRouter.get('/editOffer/:id',adminController.editOffer)
adminRouter.post('/editOfferSubmit/:id',adminController.editOfferSubmit)
adminRouter.post('/applyOffer',adminController.applyOffer)
adminRouter.post('/removeOffer',adminController.removeOffer)
adminRouter.post('/applyOfferCategory',adminController.applyOfferCategory)
adminRouter.post('/removeOfferCategory',adminController.removeOfferCategory)





module.exports=adminRouter