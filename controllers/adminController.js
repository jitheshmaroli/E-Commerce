/* eslint-disable no-case-declarations */
const User = require("../models/user");
const Order = require("../models/order");
const PDFDocument = require('pdfkit');
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
    res.render("admin/ordersList", { orders });
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
    res.render("admin/orderDetails",{order});
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

    res.redirect("/admin/ordersList");
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

        doc.text('Sales Report', { align: 'center' });
        doc.moveDown();
        reportData.forEach(report => {
            doc.text(`Date: ${report.date}`);
            doc.text(`Total Sales: ${report.totalSales}`);
            doc.text(`Orders Count: ${report.ordersCount}`);
            doc.text(`Total Discounts: ${report.totalDiscounts}`);
            doc.text(`Coupon Deductions: ${report.couponDeductions}`);
            doc.moveDown();
        });

        doc.end();
    } else if (format === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.columns = [
            { header: 'Date', key: 'date' },
            { header: 'Total Sales', key: 'totalSales' },
            { header: 'Orders Count', key: 'ordersCount' },
            { header: 'Total Discounts', key: 'totalDiscounts' },
            { header: 'Coupon Deductions', key: 'couponDeductions' },
        ];

        worksheet.addRows(reportData);

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
  downloadReport
};
