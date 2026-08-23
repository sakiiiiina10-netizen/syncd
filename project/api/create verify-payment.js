// api/verify-payment.js
// Vercel Serverless Function - Verify Razorpay Payment

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const Razorpay = require('razorpay');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      feeRecordId,
      studentId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (isValid) {
      // Get payment details from Razorpay
      const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

      // Update transaction status in Supabase
      const { error: updateTxError } = await supabase
        .from('payment_transactions')
        .update({
          status: 'success',
          gateway_payment_id: razorpay_payment_id,
          gateway_signature: razorpay_signature,
          payment_method: paymentDetails.method,
          response_data: paymentDetails,
          updated_at: new Date().toISOString()
        })
        .eq('gateway_order_id', razorpay_order_id)
        .eq('student_id', studentId);

      if (updateTxError) {
        console.error('Transaction update error:', updateTxError);
        return res.status(500).json({ error: 'Failed to update transaction' });
      }

      // Update fee record status
      const { error: updateFeeError } = await supabase
        .from('fee_records')
        .update({
          status: 'completed',
          paid_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', feeRecordId)
        .eq('student_id', studentId);

      if (updateFeeError) {
        console.error('Fee update error:', updateFeeError);
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified and recorded',
        paymentMethod: paymentDetails.method
      });

    } else {
      // Mark as failed
      const { error: failError } = await supabase
        .from('payment_transactions')
        .update({
          status: 'failed',
          gateway_payment_id: razorpay_payment_id,
          updated_at: new Date().toISOString()
        })
        .eq('gateway_order_id', razorpay_order_id)
        .eq('student_id', studentId);

      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed'
      });
    }

  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: error.message });
  }
};
