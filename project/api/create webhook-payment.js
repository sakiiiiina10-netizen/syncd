// api/webhook-payment.js
// Vercel Serverless Function - Webhook for payments from eps.eshiksa.net

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
      studentId,
      amount,
      paymentId,
      paymentMethod,
      status,
      feeRecordId
    } = req.body;

    // Validate required fields
    if (!studentId || !amount || !paymentId || !feeRecordId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (status === 'success' || status === 'completed') {
      // Insert or update payment transaction
      const { error: insertError } = await supabase
        .from('payment_transactions')
        .upsert(
          [
            {
              fee_record_id: feeRecordId,
              student_id: studentId,
              payment_gateway: 'external_gateway',
              gateway_payment_id: paymentId,
              amount: amount,
              payment_method: paymentMethod,
              status: 'success',
              response_data: req.body,
              updated_at: new Date().toISOString()
            }
          ],
          { onConflict: 'gateway_payment_id' }
        );

      if (insertError) {
        console.error('Insert error:', insertError);
        return res.status(500).json({ error: 'Failed to record payment' });
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

      console.log(`✅ Payment recorded: Student ${studentId}, Amount: ${amount}, Method: ${paymentMethod}`);

      return res.status(200).json({
        success: true,
        message: 'Payment recorded successfully'
      });

    } else {
      // Record failed payment
      const { error: failError } = await supabase
        .from('payment_transactions')
        .insert([
          {
            fee_record_id: feeRecordId,
            student_id: studentId,
            payment_gateway: 'external_gateway',
            gateway_payment_id: paymentId,
            amount: amount,
            payment_method: paymentMethod,
            status: 'failed',
            response_data: req.body
          }
        ]);

      console.log(`❌ Payment failed: Student ${studentId}, Amount: ${amount}`);

      return res.status(200).json({
        success: true,
        message: 'Payment failure recorded'
      });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
};
