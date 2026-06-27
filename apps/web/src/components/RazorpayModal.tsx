import React, { useState } from "react";
import { CreditCard, CheckCircle, AlertCircle } from "lucide-react";

type RazorpayModalProps = {
  amount: number;
  doctorName: string;
  onSuccess: (paymentId: string) => void;
  onClose: () => void;
};

export const RazorpayModal: React.FC<RazorpayModalProps> = ({ amount, doctorName, onSuccess, onClose }) => {
  const [method, setMethod] = useState<"card" | "upi" | "netbanking">("upi");
  const [upiId, setUpiId] = useState("user@okaxis");
  const [cardNumber, setCardNumber] = useState("4111 2222 3333 4444");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [processing, setProcessing] = useState(false);

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      const paymentId = "pay_" + Math.random().toString(36).substr(2, 9).toUpperCase();
      onSuccess(paymentId);
    }, 2000);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
      <div className="card" style={{ width: "400px", padding: "28px", border: "1px solid rgba(255,255,255,0.1)", background: "#111", borderRadius: "16px" }}>
        {/* Razorpay header mock */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
          <div>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase" }}>Gateway checkout</span>
            <h4 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#3399FF" }}>Razorpay / PhonePe</h4>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Amount</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>₹ {amount}</div>
          </div>
        </div>

        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "16px" }}>
          Paying to: <strong style={{ color: "white" }}>Dr. {doctorName} Telehealth slot</strong>
        </p>

        {/* Tab selection */}
        <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.02)", padding: "4px", borderRadius: "8px", border: "1px solid var(--line)", marginBottom: "16px" }}>
          {["upi", "card", "netbanking"].map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m as any)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                border: "none",
                fontSize: "0.75rem",
                fontWeight: 600,
                background: method === m ? "var(--primary)" : "transparent",
                color: method === m ? "white" : "var(--muted)",
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.2s"
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {processing ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div className="spinner" style={{ margin: "0 auto 16px auto", width: "40px", height: "40px", border: "3px solid rgba(51,153,255,0.2)", borderTopColor: "#3399FF", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Authorizing secure payment with bank...</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
            {method === "upi" && (
              <div>
                <label className="label">Virtual Payment Address (VPA / UPI ID)</label>
                <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} className="input" placeholder="name@upi" />
              </div>
            )}

            {method === "card" && (
              <>
                <div>
                  <label className="label">Card Number</label>
                  <input type="text" value={cardNumber} onChange={e => setCardNumber(e.target.value)} className="input" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label className="label">Expiry Date</label>
                    <input type="text" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} className="input" placeholder="MM/YY" />
                  </div>
                  <div>
                    <label className="label">CVV</label>
                    <input type="password" value={cardCvv} onChange={e => setCardCvv(e.target.value)} className="input" placeholder="***" />
                  </div>
                </div>
              </>
            )}

            {method === "netbanking" && (
              <div>
                <label className="label">Select Popular Indian Bank</label>
                <select className="input">
                  <option>State Bank of India</option>
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>Axis Bank</option>
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button type="button" onClick={onClose} className="button-sec" style={{ flex: 1 }}>Cancel</button>
              <button type="button" onClick={handlePay} className="button" style={{ flex: 2, background: "#3399FF" }}>
                Pay ₹ {amount}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
