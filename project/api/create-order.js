// api/create-order.js
// Vercel Serverless Function - Create Razorpay Order

const { createClient } = require('@supabase/supabase-js');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for backend
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
    const { studentId, amount, feeRecordId } = req.body;

    if (!studentId || !amount || !feeRecordId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get student details from Supabase
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `fee_${feeRecordId}_${Date.now()}`,
      notes: {
        studentId: studentId,
        feeRecordId: feeRecordId,
        studentName: student.name,
        rollNumber: student.roll_number
      }
    });

    // Store transaction record in Supabase
    const { error: insertError } = await supabase
      .from('payment_transactions')
      .insert([
        {
          fee_record_id: feeRecordId,
          student_id: studentId,
          payment_gateway: 'razorpay',
          gateway_order_id: order.id,
          amount: amount,
          status: 'pending'
        }
      ]);

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create transaction record' });
    }

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: amount,
      studentName: student.name,
      studentEmail: student.email,
      studentPhone: student.phone
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
