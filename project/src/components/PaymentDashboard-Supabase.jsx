// src/components/PaymentDashboard.jsx
// Vite + React component using Supabase Realtime

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

const PaymentDashboard = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [feeRecords, setFeeRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // ============================================
  // SETUP SUPABASE REALTIME
  // ============================================
  useEffect(() => {
    console.log('🔌 Setting up Supabase Realtime...');

    // Subscribe to changes in fee_records
    const feeRecordsSubscription = supabase
      .channel('fee_records_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fee_records'
        },
        (payload) => {
          console.log('📨 Fee record update:', payload);
          
          if (selectedStudent?.id === payload.new?.student_id || selectedStudent?.id === payload.old?.student_id) {
            // Refresh selected student's fees
            fetchStudentFees(selectedStudent.id);
          }
          
          // Refresh all students
          fetchStudents();
          
          setMessage('✅ Fee status updated!');
          setTimeout(() => setMessage(''), 3000);
        }
      )
      .subscribe();

    // Subscribe to changes in payment_transactions
    const paymentSubscription = supabase
      .channel('payments_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payment_transactions'
        },
        (payload) => {
          console.log('💳 New payment:', payload.new);
          
          if (payload.new.status === 'success') {
            setMessage(`✅ Payment Successful! Student ID: ${payload.new.student_id} - Method: ${payload.new.payment_method}`);
            
            // Refresh data
            fetchStudents();
            if (selectedStudent?.id === payload.new.student_id) {
              fetchStudentFees(payload.new.student_id);
            }
            
            setTimeout(() => setMessage(''), 5000);
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(feeRecordsSubscription);
      supabase.removeChannel(paymentSubscription);
    };
  }, [selectedStudent]);

  // ============================================
  // FETCH STUDENTS WITH SUMMARY
  // ============================================
  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // Query students with fee summary
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          roll_number,
          email,
          phone,
          class,
          fee_records (
            id,
            amount,
            status,
            fee_month
          )
        `)
        .order('name');

      if (studentsError) throw studentsError;

      // Process data to calculate summary
      const processedStudents = studentsData.map(student => {
        const fees = student.fee_records || [];
        const paidFees = fees.filter(f => f.status === 'completed').length;
        const pendingFees = fees.filter(f => f.status === 'pending').length;
        const paidAmount = fees
          .filter(f => f.status === 'completed')
          .reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);
        const pendingAmount = fees
          .filter(f => f.status === 'pending')
          .reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);

        return {
          ...student,
          total_fees: fees.length,
          paid_fees: paidFees,
          pending_fees: pendingFees,
          paid_amount: paidAmount,
          pending_amount: pendingAmount
        };
      });

      setStudents(processedStudents);
    } catch (error) {
      console.error('Error fetching students:', error.message);
      setMessage('❌ Error fetching student data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FETCH FEES FOR SELECTED STUDENT
  // ============================================
  const fetchStudentFees = async (studentId) => {
    try {
      setLoading(true);

      const { data: feeData, error: feeError } = await supabase
        .from('fee_records')
        .select(`
          id,
          amount,
          fee_month,
          status,
          due_date,
          paid_date,
          payment_transactions (
            payment_method,
            gateway_payment_id
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (feeError) throw feeError;

      // Flatten the data
      const flattened = feeData.map(fee => ({
        ...fee,
        payment_method: fee.payment_transactions?.[0]?.payment_method,
        gateway_payment_id: fee.payment_transactions?.[0]?.gateway_payment_id
      }));

      setFeeRecords(flattened);
    } catch (error) {
      console.error('Error fetching fees:', error.message);
      setMessage('❌ Error fetching fee records');
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    fetchStudents();
  }, []);

  // ============================================
  // INITIATE RAZORPAY PAYMENT
  // ============================================
  const initiatePayment = async (feeRecord) => {
    try {
      setLoading(true);

      // Step 1: Create Razorpay order via Vercel API
      const orderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          amount: feeRecord.amount,
          feeRecordId: feeRecord.id
        })
      });

      const orderData = await orderResponse.json();

      if (!orderData.success) {
        setMessage('❌ Failed to create order');
        return;
      }

      // Step 2: Open Razorpay checkout
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderData.amount * 100, // Amount in paise
        currency: 'INR',
        name: 'School Fee Payment',
        description: `Fee payment for ${feeRecord.fee_month}`,
        order_id: orderData.orderId,
        prefill: {
          name: orderData.studentName,
          email: orderData.studentEmail,
          contact: orderData.studentPhone
        },
        handler: async (response) => {
          // Step 3: Verify payment via Vercel API
          await verifyPayment(response, feeRecord.id);
        },
        modal: {
          ondismiss: () => {
            setMessage('❌ Payment cancelled');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Error initiating payment:', error);
      setMessage('❌ Error initiating payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // VERIFY PAYMENT
  // ============================================
  const verifyPayment = async (razorpayResponse, feeRecordId) => {
    try {
      setLoading(true);

      const verifyResponse = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          razorpay_order_id: razorpayResponse.razorpay_order_id,
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_signature: razorpayResponse.razorpay_signature,
          feeRecordId: feeRecordId,
          studentId: selectedStudent.id
        })
      });

      const verifyData = await verifyResponse.json();

      if (verifyData.success) {
        setMessage('✅ Payment successful! Your fee has been recorded.');
        // Data will auto-update via Realtime subscription
      } else {
        setMessage('❌ Payment verification failed');
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      setMessage('❌ Error verifying payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RENDER COMPONENT
  // ============================================
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1>📚 Student Fee & Attendance Management</h1>
        <p>Real-time payment tracking system</p>
      </div>

      {/* Message Notification */}
      {message && (
        <div style={styles.message}>
          {message}
        </div>
      )}

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Students List */}
        <div style={styles.studentsList}>
          <h2>👥 Students</h2>
          {loading && !students.length ? (
            <p style={styles.loading}>Loading...</p>
          ) : students.length > 0 ? (
            <div style={styles.gridContainer}>
              {students.map((student) => (
                <div
                  key={student.id}
                  style={{
                    ...styles.studentCard,
                    borderLeft: selectedStudent?.id === student.id ? '5px solid #4CAF50' : '5px solid #ddd',
                    backgroundColor: selectedStudent?.id === student.id ? '#f0f8f0' : '#fafafa',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onClick={() => {
                    setSelectedStudent(student);
                    fetchStudentFees(student.id);
                  }}
                >
                  <h3 style={{ margin: '0 0 8px 0' }}>{student.name}</h3>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    <strong>Roll:</strong> {student.roll_number}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    <strong>Email:</strong> {student.email || 'N/A'}
                  </p>

                  <div style={styles.stats}>
                    <div style={styles.stat}>
                      <span style={styles.statLabel}>Total</span>
                      <span style={styles.statValue}>{student.total_fees || 0}</span>
                    </div>
                    <div style={styles.stat}>
                      <span style={styles.statLabel}>Paid</span>
                      <span style={{ ...styles.statValue, color: '#4CAF50' }}>
                        {student.paid_fees || 0}
                      </span>
                    </div>
                    <div style={styles.stat}>
                      <span style={styles.statLabel}>Pending</span>
                      <span style={{ ...styles.statValue, color: '#ff9800' }}>
                        {student.pending_fees || 0}
                      </span>
                    </div>
                  </div>

                  <div style={styles.amount}>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}>
                      Paid: <strong>₹{(student.paid_amount || 0).toFixed(2)}</strong>
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}>
                      Due: <strong>₹{(student.pending_amount || 0).toFixed(2)}</strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.noData}>No students found</p>
          )}
        </div>

        {/* Fee Details */}
        {selectedStudent && (
          <div style={styles.feeDetails}>
            <h2 style={{ marginTop: 0 }}>📋 Fee Records - {selectedStudent.name}</h2>

            {loading && !feeRecords.length ? (
              <p style={styles.loading}>Loading fee records...</p>
            ) : feeRecords.length > 0 ? (
              <div style={styles.feeTable}>
                <table style={styles.table}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={styles.tableHeader}>Month</th>
                      <th style={styles.tableHeader}>Amount</th>
                      <th style={styles.tableHeader}>Due Date</th>
                      <th style={styles.tableHeader}>Status</th>
                      <th style={styles.tableHeader}>Method</th>
                      <th style={styles.tableHeader}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeRecords.map((fee) => (
                      <tr key={fee.id} style={styles.tableRow}>
                        <td style={styles.tableCell}>{fee.fee_month}</td>
                        <td style={styles.tableCell}>₹{parseFloat(fee.amount).toFixed(2)}</td>
                        <td style={styles.tableCell}>
                          {fee.due_date
                            ? new Date(fee.due_date).toLocaleDateString('en-IN')
                            : '-'}
                        </td>
                        <td style={styles.tableCell}>
                          <span style={{
                            ...styles.badge,
                            backgroundColor: fee.status === 'completed' ? '#4CAF50' : '#ff9800',
                            color: 'white'
                          }}>
                            {fee.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={styles.tableCell}>{fee.payment_method || '-'}</td>
                        <td style={styles.tableCell}>
                          {fee.status === 'pending' ? (
                            <button
                              style={styles.payButton}
                              onClick={() => initiatePayment(fee)}
                              disabled={loading}
                            >
                              {loading ? '⏳ Processing...' : '💳 Pay Now'}
                            </button>
                          ) : (
                            <span style={styles.paidText}>✓ Paid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={styles.noData}>No fee records found</p>
            )}
          </div>
        )}
      </div>

      {/* Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    </div>
  );
};

// ============================================
// STYLES
// ============================================
const styles = {
  container: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    padding: '20px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
    backgroundColor: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  message: {
    padding: '15px',
    marginBottom: '20px',
    borderRadius: '4px',
    backgroundColor: '#e8f5e9',
    border: '1px solid #4CAF50',
    color: '#2e7d32',
    animation: 'slideIn 0.3s ease'
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '20px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  studentsList: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    maxHeight: '700px',
    overflowY: 'auto'
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px'
  },
  studentCard: {
    padding: '15px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    transition: 'all 0.3s ease'
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    margin: '10px 0',
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px'
  },
  stat: {
    textAlign: 'center'
  },
  statLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#999',
    marginBottom: '4px',
    fontWeight: '500'
  },
  statValue: {
    display: 'block',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333'
  },
  amount: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    fontSize: '12px'
  },
  feeDetails: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    maxHeight: '700px',
    overflowY: 'auto'
  },
  feeTable: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  },
  tableHeader: {
    padding: '12px 8px',
    textAlign: 'left',
    fontWeight: 'bold',
    color: '#333'
  },
  tableRow: {
    borderBottom: '1px solid #eee',
    '&:hover': {
      backgroundColor: '#f9f9f9'
    }
  },
  tableCell: {
    padding: '12px 8px',
    borderBottom: '1px solid #eee'
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  payButton: {
    padding: '6px 12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'background-color 0.2s'
  },
  paidText: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  loading: {
    textAlign: 'center',
    color: '#999',
    padding: '20px'
  },
  noData: {
    textAlign: 'center',
    color: '#999',
    padding: '20px'
  }
};

export default PaymentDashboard;
