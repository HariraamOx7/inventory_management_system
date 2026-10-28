// Rebuild PO statuses using the application's existing received-quantity logic.
require('dotenv').config({quiet:true});
if(!/^stores_stage_[a-z0-9_]+$/.test(process.env.DB_NAME||'')) throw new Error('DB_NAME must identify an isolated migration stage');
const {sequelize,PurchaseOrder,Receipt}=require('../models');
const {recalcPOStatus}=require('../controllers/gateInwardController');
async function main(){try{const orders=await PurchaseOrder.findAll({attributes:['OrderNo'],raw:true});for(const order of orders)await recalcPOStatus(order.OrderNo);await Receipt.update({Status:'ReceiptCreated'},{where:{}});const [statuses]=await sequelize.query('SELECT Status,COUNT(*) AS count FROM purchase_orders GROUP BY Status');console.log(JSON.stringify({orders:orders.length,statuses}));}finally{await sequelize.close();}}
main().catch(error=>{console.error(error.message);process.exitCode=1});
