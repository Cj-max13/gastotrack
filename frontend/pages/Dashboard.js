import { useEffect, useState } from "react";
import { getTransactions } from "../services/api";

export default function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    getTransactions().then(res => setData(res.data));
  }, []);

  return (
    <div>
      <h2>Transactions</h2>
      {data.map(tx => (
        <div key={tx.id}>
          {tx.merchant} - ₱{tx.amount} ({tx.category})
        </div>
      ))}
    </div>
  );
}