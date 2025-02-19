const User = require("../../models/user");
const Category = require("../../models/category");
const Addresses =require("../../models/address");


const addressesView = async (req, res) => {
    try {
      const user = await User.findOne({email: req.session.userId || req.session.passport.user.userId});
      const categoryList = await Category.find({isBlocked:false});
      const address = await Addresses.findOne({
        userId:user._id
      }).populate('address');
      if(!address){
        return res.render("users/addrss/address", { user, addresses:"" ,categoryList });
      }
  
      res.render("users/address/address", { user, addresses:address , categoryList });
    } catch (error) {
      console.log(error);
      res.status(500).send("Internal server error");
    }
  };
  
  const addAddressView = async (req,res) => {
    try {
      const user = await User.findOne({email:req.session.userId || req.session.passport.user.userId});
      const categoryList = await Category.find({isBlocked:false});
      res.render("users/address/addAddress",{user,message:'', categoryList});
    } catch (error) {
      console.log(error)
      res.status(500).send("internal error")
    }
  };

  const addAddress = async (req, res) => {
    try {
      const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
      const { name, houseName, street, city, district, state, pinCode } = req.body;
  
    
      const newAddress = {
        name,
        houseName,
        street,
        city,
        district,
        state,
        pinCode
      };
  
      let address = await Addresses.findOne({ userId: user._id });
      if (!address) {
        address = new Addresses({ userId: user._id, address: [] });
      }
      
      address.address.push(newAddress);
  
     
      await address.save();
  
      res.render("users/address/addAddress", { user, message: 'Address added successfully'});
    } catch (error) {
      console.error('Error adding address:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
  
  const addNewAddress = async (req, res) => {
    try {
      const user = await User.findOne({ email: req.session.userId || req.session.passport.user.userId });
      const { name, houseName, street, city, district, state, pinCode, isDefault } = req.body;
  
      const newAddress = {
        name,
        houseName,
        street,
        city,
        district,
        state,
        pinCode,
        isDefault 
      };
  
      let address = await Addresses.findOne({ userId: user._id });
      if (!address) {
        address = new Addresses({ userId: user._id, address: [] });
      }
  
      // If the new address should be set as default
      if (newAddress.isDefault) {
        // Set all existing addresses to non-default
        address.address = address.address.map(addr => ({ ...addr, isDefault: false }));
      }
  
      address.address.push(newAddress);
      await address.save();
      res.json({success:true})
      // res.render("users/addAddress", { user, message: 'Address added successfully' });
    } catch (error) {
      console.error('Error adding address:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };

  const setDefault = async (req, res) => {
    const { addressId } = req.body;
  
    try {
      const user = await User.findOne({
        email: req.session.userId || req.session.passport.user.userId,
      });
  
      const userId = user._id;
  
      console.log(user._id)
      const addressDoc = await Addresses.findOne({ userId: userId});
  
      if (!addressDoc) {
        return res.status(404).json({ success: false, message: 'Address document not found' });
      }
  
      // Update isDefault for all addresses (using atomic operator)
      // await Addresses.updateOne(
      //   { userId: user._id },
      //   { $set: { 'address.$[].isDefault': false } }
      // );
  
     await Addresses.findOneAndUpdate(
        { userId: userId }, 
        { $set: { "address.$[].isDefault": false } },
        { upsert: false, returnOriginal: false }
      )
  
  
      
      await Addresses.updateOne(
        { userId: user._id, 'address._id': addressId },
        { $set: { 'address.$.isDefault': true } }
      );
  
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
  
  
  
  
  
  const setDefaultAddress = async (req, res) => {
    try {
      const user = await User.findOne({
        email: req.session.userId || req.session.passport.user.userId
      });
      const userId = user._id;
      const addressId = req.params.addressId;
      const isDefault = req.body.isDefault;
  
      await Addresses.updateMany(
        { userId, 'address._id': { $ne: addressId } },
        { $set: { 'address.$[].isDefault': false } }
      );
  
      const updatedAddress = await Addresses.findOneAndUpdate(
        { userId, 'address._id': addressId },
        { $set: { 'address.$.isDefault': isDefault } },
        { new: true }
      );
      updatedAddress.address.forEach((addr) => {
        addr.isDefaultForUI = addr._id.toString() === addressId;
      });
  
      res.json({
        message: 'Default address updated successfully',
        updatedAddress: updatedAddress.address
      });
    } catch (error) {
      console.error('Error setting default address:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  const editAddressView = async (req, res) => {
    try {
      const user = await User.findOne({
        email: req.session.userId || req.session.passport.user.userId,
      });
  
      const addressId = req.params.addressId;
      const addressDoc = await Addresses.findOne({ userId: user._id });
      const categoryList = await Category.find({isBlocked:false});
  
      if (!addressDoc) {
        return res.status(404).json({ error: 'No addresses found for this user' });
      }
  
      const address = addressDoc.address.find(
        (addr) => addr._id.toString() === addressId
      );
  
      if (!address) {
        return res.status(404).json({ error: 'Address not found' });
      }
  
      res.render("users/address/editAddress", { user, address,message:'' , categoryList });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  const updateAddress = async (req, res) => {
    const addressId = req.query.addressId;
    console.log("updating")
    try {
      const user = await User.findOne({
        email: req.session.userId || req.session.passport.user.userId,
      });
      const addressDoc = await Addresses.findOne({ userId: user._id });
      console.log(addressDoc)
  
      if (!addressDoc) {
        return res.status(404).json({ error: 'Address not found' });
      }
  
      const addressIndex = addressDoc.address.findIndex(
        (addr) => addr._id.toString() === addressId
      );
  
      if (addressIndex === -1) {
        return res.status(404).json({ error: 'Address not found' });
      }
  
      console.log(addressIndex);
      addressDoc.address[addressIndex].name = req.body.name;
      addressDoc.address[addressIndex].houseName = req.body.houseName;
      addressDoc.address[addressIndex].street = req.body.street;
      addressDoc.address[addressIndex].city = req.body.city;
      addressDoc.address[addressIndex].district = req.body.district;
      addressDoc.address[addressIndex].state = req.body.state;
      addressDoc.address[addressIndex].pinCode = req.body.pinCode;
      addressDoc.address[addressIndex].isDefault = req.body.isDefault === true;
  
      if (req.body.isDefault) {
        console.log("if consdtition")
        addressDoc.address.forEach((address) => {
          if (address._id.toString() !== addressId) {
            address.isDefault = false;
          }
        });
      }
      console.log(req.body.isDefault+"addresssss")
      console.log(addressDoc)
      await addressDoc.save();
      res.json({success:true});
      // res.redirect('/address');
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  const deleteAddress = async (req, res) => {
    try {
      const addressId = req.params.addressId;
      const user = await User.findOne({
        email: req.session.userId || req.session.passport.user.userId,
      });
      const addressDoc = await Addresses.findOne({ userId: user._id });
  
      if (!addressDoc) {
        return res.status(404).json({ error: 'Address not found' });
      }
  
      const addressIndex = addressDoc.address.findIndex(
        (addr) => addr._id.toString() === addressId
      );
  
      if (addressIndex === -1) {
        return res.status(404).json({ error: 'Address not found' });
      }
  
      if (addressDoc.address[addressIndex].isDefault) {
        return res.status(403).json({ error: 'Cannot delete default address' });
      }
  
  
      addressDoc.address.splice(addressIndex, 1);
  
      await addressDoc.save();
  
      res.redirect("/address")
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  const getAddress = async (req, res) => {
    try {
      const addressId = req.params.addressId;
      const user = await User.findOne({
        email: req.session.userId || req.session.passport.user.userId,
      });
      const addressDoc = await Addresses.findOne({ userId: user._id });
      const address = addressDoc.address.id(addressId);
      res.json({ address});
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

module.exports = {
    addAddress,
    addAddressView,
    addressesView,
    updateAddress,
    deleteAddress,
    addNewAddress,
    editAddressView,
    setDefault,
    setDefaultAddress,
    getAddress
}