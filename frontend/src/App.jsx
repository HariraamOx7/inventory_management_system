import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Department from './pages/Department';
import Supplier from './pages/Supplier';
import StoreMaster from './pages/StoreMaster.jsx';
import ProdHeadMaster from './pages/ProdHeadMaster.jsx';
import SubHead from './pages/SubHead.jsx';
import Item from './pages/Item.jsx';
import UOM from './pages/UOM.jsx';
import PurchaseType from './pages/PurchaseType.jsx';
import GPPartyMaster from './pages/PartyMaster.jsx';
import GPItemMaster from './pages/ItemMaster.jsx';
import State from './pages/State.jsx';

import PurchaseOrder from './pages/PurchaseOrder.jsx';
import GateInward from './pages/GateInward.jsx';
import Receipt from './pages/Receipt.jsx';
import BillEntry from './pages/BillEntry.jsx';
import ItemIssue from './pages/ItemIssue.jsx';
import GatePassOut from './pages/GatePassOut.jsx';
import GatePassIn from './pages/GatePassIn.jsx';
import Reports from './pages/Reports.jsx';
import CancelOrder from './pages/CancelOrder';
import BillVerify from './pages/BillVerify';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/department" 
          element={
            <ProtectedRoute>
              <Department />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/supplier" 
          element={
            <ProtectedRoute>
              <Supplier />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/storemaster" 
          element={
            <ProtectedRoute>
              <StoreMaster />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/prodheadmaster" 
          element={
            <ProtectedRoute>
              <ProdHeadMaster />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/subhead" 
          element={
            <ProtectedRoute>
              <SubHead />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/item" 
          element={
            <ProtectedRoute>
              <Item />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/uom" 
          element={
            <ProtectedRoute>
              <UOM />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/purchasetype" 
          element={
            <ProtectedRoute>
              <PurchaseType />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/gppartymaster" 
          element={
            <ProtectedRoute>
              <GPPartyMaster />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/gpitemmaster" 
          element={
            <ProtectedRoute>
              <GPItemMaster />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/state" 
          element={
            <ProtectedRoute>
              <State />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/transaction/purchase-order" 
          element={
            <ProtectedRoute>
              <PurchaseOrder />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/transaction/gate-inward" 
          element={
            <ProtectedRoute>
              <GateInward />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/transaction/receipt" 
          element={
            <ProtectedRoute>
              <Receipt />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/transaction/bill-entry" 
          element={
            <ProtectedRoute>
              <BillEntry />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/transaction/issue" 
          element={
            <ProtectedRoute>
              <ItemIssue />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/transaction/gate-pass-out" 
          element={
            <ProtectedRoute>
              <GatePassOut />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/transaction/gate-pass-in" 
          element={
            <ProtectedRoute>
              <GatePassIn />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reports" 
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/cancel-order" 
          element={
            <ProtectedRoute>
              <CancelOrder />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/bill-verify" 
          element={
            <ProtectedRoute>
              <BillVerify />
            </ProtectedRoute>
          } 
        />

        {/* Redirect any unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;