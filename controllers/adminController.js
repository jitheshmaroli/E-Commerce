/* eslint-disable no-case-declarations */
const User = require("../models/user");
const Order = require("../models/order");

const adminHome = async (req, res) => {
  try {
    res.render("admin/dashboard");
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
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
      .populate("userId")
      .sort({ createdAt: -1 });
    res.render("admin/ordersList", { orders });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

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
    const reportType = req.query.type;
    let startDate, endDate;

    // Calculate start and end dates based on the report type
    switch (reportType) {
      case 'daily':
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = now;
        console.log('Daily start date:', startDate);
        console.log('Daily end date:', endDate);
        break;
      case 'weekly':
        const currentDate = new Date();
        const dayOfWeek = currentDate.getDay();
        const diffDays = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(currentDate.setDate(currentDate.getDate() - diffDays));
        endDate = new Date(currentDate.setDate(currentDate.getDate() + (7 - diffDays)));
        break;
      case 'monthly':
        const year = new Date().getFullYear();
        const month = new Date().getMonth();
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0);
        break;
      case 'custom':
        if (!req.query.startDate || !req.query.endDate) {
          return res.status(400).json({ error: 'Start and end dates are required for custom report' });
        }
        startDate = new Date(req.query.startDate);
        endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999); // Set end date to the end of the day
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    // Find orders within the date range
    const orders = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          totalSales: { $sum: '$totalCost' },
          ordersCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalSales: 1,
          ordersCount: 1
        }
      }
    ]);

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
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
  salesReport
};
