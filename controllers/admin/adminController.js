/* eslint-disable no-case-declarations */
const User = require("../../models/user");
const Order = require("../../models/order");
const PDFDocument = require('pdfkit-table');
const ExcelJS = require('exceljs');

const adminHome = async (req, res) => {
  try {
    res.render("admin/dashboard");
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const formatReportData = (orders) => {
  return orders.map(order => ({
      date: order.createdAt.toISOString().split('T')[0],
      totalSales: order.totalCost,
      ordersCount: order.items.length,
      totalDiscounts: order.priceDetails.discountAmount,
      couponDeductions: order.couponCode ? order.priceDetails.discountAmount : 0
  }));
};

const blockUser = async (req, res) => {
  try {
    const userEmail = req.params.userEmail;
    const userData = await User.findOne({ email: userEmail });

    if (!userData) {
      return res.status(404).json({ error: "User not found" });
    }

    userData.isBlocked = !userData.isBlocked;
    await userData.save();

    res.status(200).json({
      message: "User block status updated successfully",
      user: userData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const userListView = async (req, res) => {
  try {
    const allUsers = await User.find();
    const users = allUsers.filter((user) => !user.isAdmin);
    res.render("admin/usersList", { users });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

const logoutViewAdmin = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        res.status(500).send("Internal Server Error");
      } else {
        res.redirect("/login");
      }
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const ordersListView = async (req, res) => {
  try {
    const orders = await Order.find()
    .populate("userId", "name email photo isVerified isAdmin isBlocked") 
    .populate({
      path: "items.productId", 
      model: "products" 
    })
    .sort({ createdAt: -1 });
    console.log(orders)
    res.render("admin/orders/ordersList", { orders });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

const orderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById({_id: orderId})
    .populate("userId", "name email photo isVerified isAdmin isBlocked") 
    .populate({ path: "items.productId", model: "products" })
    .populate('deliveryAddress');
    console.log(order)
    res.render("admin/orders/orderDetails",{order});
  } catch (error) {
    res.status(500).send(error.message);
  }
}

const updateOrderStatus = async (req, res) => {
  const { orderId, productId } = req.params;
  const status = req.query.status;
  console.log("status=" + status);
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    order.items.forEach((item) => {
      if (item.productId.toString() === productId) {
        if (status === "Cancelled") {
          item.status = "Cancelled";
        } else if (status === "Shipped") {
          item.status = "Shipped";
        } else if (status === "Delivered") {
          item.status = "Delivered";
        }
      }
    });

    await order.save();

    res.json();
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const cancel = req.query.cancel;
    console.log(cancel + "cancelled" + " " + productId);

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.redirect("/admin/orders/ordersList");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error cancelling order");
  }
};


const salesReport = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    let filter = {};
    if (type === 'custom' && startDate && endDate) {
        filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else {
        let date = new Date();
        switch (type) {
            case 'daily':
                filter.createdAt = { $gte: new Date(date.setHours(0, 0, 0, 0)), $lt: new Date(date.setHours(23, 59, 59, 999)) };
                break;
            case 'weekly':
                let weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
                filter.createdAt = { $gte: new Date(weekStart.setHours(0, 0, 0, 0)), $lt: new Date() };
                break;
            case 'yearly':
                filter.createdAt = { $gte: new Date(date.getFullYear(), 0, 1), $lt: new Date(date.getFullYear() + 1, 0, 1) };
                break;
        }
    }

    const orders = await Order.find(filter);
    const reportData = formatReportData(orders);

    res.json(reportData);
  } catch (error) {
      res.status(500).json({ message: 'Error fetching sales report', error });
  }
};


const downloadReport =  async (req, res) => {
  try {
    const { format, type, startDate, endDate } = req.query;

    let filter = {};
    if (type === 'custom' && startDate && endDate) {
        filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else {
        let date = new Date();
        switch (type) {
            case 'daily':
                filter.createdAt = { $gte: new Date(date.setHours(0, 0, 0, 0)), $lt: new Date(date.setHours(23, 59, 59, 999)) };
                break;
            case 'weekly':
                let weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
                filter.createdAt = { $gte: new Date(weekStart.setHours(0, 0, 0, 0)), $lt: new Date() };
                break;
            case 'yearly':
                filter.createdAt = { $gte: new Date(date.getFullYear(), 0, 1), $lt: new Date(date.getFullYear() + 1, 0, 1) };
                break;
        }
    }

    const orders = await Order.find(filter);
    const reportData = formatReportData(orders);

    if (format === 'pdf') {
      const doc = new PDFDocument();
      res.setHeader('Content-disposition', 'attachment; filename=sales_report.pdf');
      res.setHeader('Content-type', 'application/pdf');
      doc.pipe(res);

      doc.fontSize(16).text('Sales Report', { align: 'center' });
      doc.moveDown();

      const table = {
        headers: ['Index', 'Date', 'Total Sales', 'Orders Count', 'Total Discounts', 'Coupon Deductions'],
        rows: reportData.map((report, index) => [
          index + 1,
          report.date,
          report.totalSales.toFixed(2),
          report.ordersCount,
          report.totalDiscounts.toFixed(2),
          report.couponDeductions.toFixed(2)
        ])
      };

      doc.table(table, {
        prepareHeader: () => doc.font('Helvetica-Bold'),
        // eslint-disable-next-line no-unused-vars
        prepareRow: (row, i) => doc.font('Helvetica').fontSize(10)
      });

      doc.end();
    } else if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');

      worksheet.columns = [
        { header: 'Index', key: 'index', width: 10 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Total Sales', key: 'totalSales', width: 15 },
        { header: 'Orders Count', key: 'ordersCount', width: 15 },
        { header: 'Total Discounts', key: 'totalDiscounts', width: 15 },
        { header: 'Coupon Deductions', key: 'couponDeductions', width: 20 },
      ];

      // Add header row
      worksheet.getRow(1).font = { bold: true };

      // Add data rows with index
      reportData.forEach((report, index) => {
        worksheet.addRow({
          index: index + 1,
          date: report.date,
          totalSales: report.totalSales,
          ordersCount: report.ordersCount,
          totalDiscounts: report.totalDiscounts,
          couponDeductions: report.couponDeductions
        });
      });

      // Format number columns
      ['C', 'E', 'F'].forEach(col => {
        worksheet.getColumn(col).numFmt = '#,##0.00';
      });

      // Add borders
      // eslint-disable-next-line no-unused-vars
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: {style:'thin'},
            left: {style:'thin'},
            bottom: {style:'thin'},
            right: {style:'thin'}
          };
        });
      });

      res.setHeader('Content-disposition', 'attachment; filename=sales_report.xlsx');
      res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await workbook.xlsx.write(res);
      res.end();
    } else {
        res.status(400).json({ message: 'Invalid format' });
    }
} catch (error) {
    res.status(500).json({ message: 'Error downloading sales report', error });
}
};

const dashboard = async (req, res) => {
  try {
    const filter = req.query.filter || 'yearly';
    
    const chartData = await processOrdersForChart(filter);
    const topProducts = await getTopProducts();
    const topCategories = await getTopCategories();
    const recentOrders = await getRecentOrders();
    
    res.json({
      chartData,
      topProducts,
      topCategories,
      recentOrders
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function processOrdersForChart(filter) {
  let groupBy, sortBy, dateProject;
  
  switch(filter) {
    case 'weekly':
      groupBy = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      sortBy = { '_id.year': 1, '_id.week': 1 };
      dateProject = {
        $concat: [
          { $toString: '$_id.year' },
          '-W',
          { $toString: { $cond: [{ $lt: ['$_id.week', 10] }, { $concat: ['0', { $toString: '$_id.week' }] }, { $toString: '$_id.week' }] } }
        ]
      };
      break;
    case 'monthly':
      groupBy = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      sortBy = { '_id.year': 1, '_id.month': 1 };
      dateProject = {
        $concat: [
          { $toString: '$_id.year' },
          '-',
          { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] }
        ]
      };
      break;
    case 'yearly':
    default:
      groupBy = { year: { $year: '$createdAt' } };
      sortBy = { '_id.year': 1 };
      dateProject = { $toString: '$_id.year' };
  }

  const aggregateResult = await Order.aggregate([
    {
      $group: {
        _id: groupBy,
        totalSales: { $sum: '$totalCost' }
      }
    },
    {
      $sort: sortBy
    },
    {
      $project: {
        _id: 0,
        date: dateProject,
        totalSales: 1
      }
    }
  ]);

  const labels = aggregateResult.map(item => item.date);
  const data = aggregateResult.map(item => item.totalSales);

  return {
    labels,
    datasets: [{
      label: 'Total Sales',
      data,
      borderColor: 'rgba(75, 192, 192, 1)',
      tension: 0.1
    }]
  };
}

async function getTopProducts() {
  return await Order.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.status': { $ne: 'Cancelled' } } },
    {
      $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$product.name' },
        totalQuantity: { $sum: '$items.quantity' }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        id: '$_id',
        name: 1,
        sales: '$totalQuantity'
      }
    }
  ]);
}

async function getTopCategories() {
  return await Order.aggregate([
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        totalQuantity: { $sum: '$items.quantity' }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: '$category' },
    { $sort: { totalQuantity: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        id: '$_id',
        name: '$category.categoryName',
        sales: '$totalQuantity'
      }
    }
  ]);
}

async function getRecentOrders() {
  return await Order.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$_id',
        totalCost: { $first: '$totalCost' },
        createdAt: { $first: '$createdAt' },
        itemStatuses: {
          $push: {
            productName: '$product.name',
            status: '$items.status'
          }
        }
      }
    },
    {
      $project: {
        _id: 1,
        totalCost: 1,
        createdAt: 1,
        itemStatuses: 1
      }
    }
  ]);
}



module.exports = {
  adminHome,
  blockUser,
  userListView,
  logoutViewAdmin,
  ordersListView,
  updateOrderStatus,
  cancelOrder,
  salesReport,
  orderDetails,
  downloadReport,
  dashboard,
};
