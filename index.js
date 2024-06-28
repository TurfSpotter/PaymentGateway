// const express=require("express");
// const app=express();
// const dotenv=require("dotenv");
// const axios = require('axios');
// const unique_id=require("uniqid");
// const sha=require("sha256");

// dotenv.config({
//     path:'./.env'
// })

// console.log(process.env.MERCHANT_ID);

// // console.log(`${process.env.PAYMENT_POST_URL}${process.env.PAYMENT_ENDPOINT}`);
// app.get("/payment",(req,res)=>{

//     const mtransid=unique_id();
//     // console.log(`this is test ${mtransid}`);
//     const muserid="MUID123";

//     const payload={
//         "merchantId": process.env.MERCHANT_ID,
//         "merchantTransactionId": mtransid,
//         "merchantUserId": muserid,
//         "amount": 100,
//         "redirectUrl": `http://localhost:2025/redirect-url/${mtransid}`,
//         "redirectMode": "REDIRECT",
//         // "callbackUrl": "https://webhook.site/callback-url",
//         "mobileNumber": 7305370425,
//         "paymentInstrument": {
//           "type": "PAY_PAGE"
//         }
//       }

//       const buffer=Buffer.from(JSON.stringify(payload),"utf8");
//       const base64ref=buffer.toString("base64");
//       // console.log(base64ref);

//     //   const xverify="SHA256(base64 encoded payload + “/pg/v1/pay” +salt key) + ### + salt index";
//     const xverify=sha(base64ref+process.env.PAYMENT_ENDPOINT+process.env.SALT_KEY)+"###"+process.env.SALT_KEY_INDEX;
//     console.log(xverify);
//     const options = {
//         method: 'post',
//         url: `${process.env.PAYMENT_POST_URL}${process.env.PAYMENT_ENDPOINT}`,
//         headers: {
//               accept: 'application/json',
//               'Content-Type': 'application/json',
//               'X_VERIFY':xverify
//                       },
//       data: {
//         request:base64ref
//       }
//       };
//       axios
//         .request(options)
//             .then(function (response) {
//             console.log(response.data);
//             res.send(response.data);
//         })
//         .catch(function (error) {
//           console.error(error);
//         });
// })

// app.listen(process.env.PORT_NO,()=>{
//     console.log("port connected");
// })

// importing modules
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");
const dotenv=require("dotenv");

// creating express application
const app = express();

dotenv.config({
  path:"./.env"
})

// UAT environment
const MERCHANT_ID = process.env.MERCHANT_ID;
const PHONE_PE_HOST_URL = process.env.PAYMENT_POST_URL;
const SALT_INDEX = process.env.SALT_KEY_INDEX;
const SALT_KEY = process.env.SALT_KEY;
const APP_BE_URL = "http://localhost:3002"; // our application

// setting up middleware
app.use(cors({origin:"*"}));
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);

app.get('/show',(req,res)=>{
  // res.send("showing");
  console.log("showing");
})

// Defining a test route
app.get("/", (req, res) => {
  console.log("works");
  // res.send("PhonePe Integration APIs!");
});

// endpoint to initiate a payment
app.get("/pay", async function (req, res, next) {
  // Initiate a payment

  // Transaction amount
  const amount = 10;

  // User ID is the ID of the user present in our application DB
  let userId = "MUID123";

  // Generate a unique merchant transaction ID for each transaction
  let merchantTransactionId = uniqid();

  // redirect url => phonePe will redirect the user to this url once payment is completed. It will be a GET request, since redirectMode is "REDIRECT"
  let normalPayLoad = {
    merchantId: process.env.MERCHANT_ID, //* PHONEPE_MERCHANT_ID . Unique for each account (private)
    merchantTransactionId: merchantTransactionId,
    merchantUserId: userId,
    amount: amount * 100, // converting to paise
    redirectUrl: `https://www.turfspotter.com`,
    redirectMode: "REDIRECT",
    mobileNumber: "9999999999",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  // make base64 encoded payload
  let bufferObj = Buffer.from(JSON.stringify(normalPayLoad), "utf8");
  let base64EncodedPayload = bufferObj.toString("base64");

  // X-VERIFY => SHA256(base64EncodedPayload + "/pg/v1/pay" + SALT_KEY) + ### + SALT_INDEX
  let string = base64EncodedPayload + "/pg/v1/pay" + process.env.SALT_KEY;
  let sha256_val = sha256(string);
  let xVerifyChecksum = sha256_val + "###" + process.env.SALT_KEY_INDEX;

  axios
    .post(
      `${process.env.PAYMENT_POST_URL}/pg/v1/pay`,
      {
        request: base64EncodedPayload,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          accept: "application/json",
        },
      }
    )
    .then(function (response) {
      // console.log("response->", JSON.stringify(response.data));
      // console.log("this is"+response.data.data.instrumentResponse.redirectInfo.url);
      res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
    })
    .catch(function (error) {
      res.send(error);
    });
});

// endpoint to check the status of payment
app.get("/payment/validate/:merchantTransactionId", async function (req, res) {
  const { merchantTransactionId } = req.params;
  console.log(merchantTransactionId);
  // check the status of the payment using merchantTransactionId
  if (merchantTransactionId) {
    let statusUrl =`${process.env.PAYMENT_POST_URL}/pg/v1/status/${process.env.MERCHANT_ID}/${merchantTransactionId}`;
      // console.log("this one"+statusUrl);

    // generate X-VERIFY
    let string =
      `/pg/v1/status/${process.env.MERCHANT_ID}/${merchantTransactionId}${process.env.SALT_KEY}`;
      console.log("this is"+string);
    let sha256_val = sha256(string);
    let xVerifyChecksum = sha256_val + "###" + process.env.SALT_KEY_INDEX;

    console.log(statusUrl);

    axios
      .get(statusUrl, {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerifyChecksum,
          "X-MERCHANT-ID": merchantTransactionId,
          accept: "application/json",
        },
        // console.log("runs");
      })
      .then(function async(response) {
        console.log("response->", response.data);
        if (response.data && response.data.code === "PAYMENT_SUCCESS") {
          // redirect to FE payment success status page
          res.send(response.data);
        } else {
          // redirect to FE payment failure / pending status page
        }
      })
      .catch(function (error) {
        // redirect to FE payment failure / pending status page
        res.send(error);
      });
  } else {
    res.send("Sorry TurfSpotter!! Error");
  }
});

// Starting the server
const port = 3002;
app.listen(port, () => {
  console.log(`PhonePe application listening on port ${port}`);
});