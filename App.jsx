import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import React, { useState, useEffect } from 'react';
import './App.css';
import { LineChart, BarChart, PieChart, Pie, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Wallet, CreditCard, DollarSign, TrendingUp, BarChart2, PieChart as PieChartIcon, Settings, Plus, Search, Filter, X, Calendar, Edit, Trash2, Save, ArrowUpDown, Download } from 'lucide-react';
import { CheckCircle, Save as SaveIcon, XCircle, AlertTriangle, User, Bell, Lock, Moon, SunMedium, Languages, KeyRound, LogIn, LogOut, ShieldCheck, Fingerprint} from 'lucide-react'; // Renamed Save

// Sample data - in a real app, this would come from your state management or API
const initialData = {
  expenses: [
    { id: 1, amount: 25.50, category: 'Food', date: '2025-03-25', description: 'Grocery shopping' },
    { id: 2, amount: 45.00, category: 'Transport', date: '2025-03-26', description: 'Gas' },
    { id: 3, amount: 1200.00, category: 'Rent', date: '2025-03-01', description: 'Monthly rent' },
    { id: 4, amount: 35.99, category: 'Entertainment', date: '2025-03-27', description: 'Streaming subscription' }
  ],
  income: [
    { id: 1, amount: 3500.00, source: 'Salary', date: '2025-03-15', description: 'Monthly salary' },
    { id: 2, amount: 200.00, source: 'Freelance', date: '2025-03-20', description: 'Design project' }
  ],
  budgets: [
    { id: 1, category: 'Food', amount: 400.00, period: 'Monthly' },
    { id: 2, category: 'Transport', amount: 200.00, period: 'Monthly' },
    { id: 3, category: 'Entertainment', amount: 100.00, period: 'Monthly' },
    { id: 4, category: 'Rent', amount: 1200.00, period: 'Monthly' }
  ],
  categories: ['Food', 'Transport', 'Rent', 'Entertainment', 'Utilities', 'Healthcare', 'Education', 'Shopping', 'Other']
};

// Calculate spending by category for charts
const calculateSpendingByCategory = (expenses) => {
  const result = {};
  expenses.forEach(expense => {
    if (result[expense.category]) {
      result[expense.category] += expense.amount;
    } else {
      result[expense.category] = expense.amount;
    }
  });
  
  return Object.keys(result).map(category => ({
    name: category,
    value: result[category]
  }));
};

// Monthly spending for line chart
const monthlyData = [
  { name: 'Jan', spending: 2100 },
  { name: 'Feb', spending: 1950 },
  { name: 'Mar', spending: 1306.49 }
];

// Modal component for forms
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#1A2435] rounded-lg shadow-lg w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-muted-20">
          <h3 className="text-lg font-medium">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Button component
const Button = ({ children, variant = "primary", onClick, className = "", size = "md" }) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#121A2A] focus:ring-purple";
  
  const variants = {
    primary: "bg-purple text-dark hover:bg-purple-400",
    secondary: "bg-muted hover:bg-muted-20 text-light",
    danger: "bg-red-500 hover:bg-red-600 text-white"
  };
  
  const sizes = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  };

  return (
    <button 
      onClick={onClick} 
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

// Sidebar component that works with Router
const Sidebar = ({ data }) => {
  const location = useLocation();
  const currentPath = location.pathname.substring(1) || 'dashboard';
  
  // Calculate balance for the sidebar
  const totalExpenses = data.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalIncome = data.income.reduce((sum, income) => sum + income.amount, 0);
  const balance = totalIncome - totalExpenses;

  return (
    <div className="w-64 border-r border-muted-20 flex flex-col">
      <div className="p-6 border-b border-muted-20">
        <h1 className="text-xl font-bold flex items-center">
          <Wallet className="mr-2" size={24} />
          FinTrack
        </h1>
      </div>
      <nav className="flex-1 p-4">
        <ul>
          <li className="mb-2">
            <Link 
              to="/"
              className={`flex items-center w-full p-3 rounded-lg ${currentPath === 'dashboard' ? 'bg-purple text-dark' : 'hover:bg-muted'}`}
            >
              <BarChart2 size={20} className="mr-3" />
              Dashboard
            </Link>
          </li>
          <li className="mb-2">
            <Link 
              to="/expenses"
              className={`flex items-center w-full p-3 rounded-lg ${currentPath === 'expenses' ? 'bg-purple text-dark' : 'hover:bg-muted'}`}
            >
              <CreditCard size={20} className="mr-3" />
              Expenses
            </Link>
          </li>
          <li className="mb-2">
            <Link 
              to="/income"
              className={`flex items-center w-full p-3 rounded-lg ${currentPath === 'income' ? 'bg-purple text-dark' : 'hover:bg-muted'}`}
            >
              <DollarSign size={20} className="mr-3" />
              Income
            </Link>
          </li>
          <li className="mb-2">
            <Link 
              to="/budgets"
              className={`flex items-center w-full p-3 rounded-lg ${currentPath === 'budgets' ? 'bg-purple text-dark' : 'hover:bg-muted'}`}
            >
              <TrendingUp size={20} className="mr-3" />
              Budgets
            </Link>
          </li>
          <li className="mb-2">
            <Link 
              to="/reports"
              className={`flex items-center w-full p-3 rounded-lg ${currentPath === 'reports' ? 'bg-purple text-dark' : 'hover:bg-muted'}`}
            >
              <PieChartIcon size={20} className="mr-3" />
              Reports
            </Link>
          </li>
          <li className="mb-2">
            <Link 
              to="/settings"
              className={`flex items-center w-full p-3 rounded-lg ${currentPath === 'settings' ? 'bg-purple text-dark' : 'hover:bg-muted'}`}
            >
              <Settings size={20} className="mr-3" />
              Settings
            </Link>
          </li>
        </ul>
      </nav>
      <div className="p-4 border-t border-muted-20">
        <div className="rounded-lg bg-card p-4">
          <h3 className="text-sm font-medium text-[#9AA5B1]">Current Balance</h3>
          <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${balance.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};

// Dashboard component
const Dashboard = ({ data }) => {
  // Calculate totals
  const totalExpenses = data.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalIncome = data.income.reduce((sum, income) => sum + income.amount, 0);
  const balance = totalIncome - totalExpenses;
  
  // Prepare data for charts
  const spendingByCategory = calculateSpendingByCategory(data.expenses);
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-card rounded-lg p-6">
          <h3 className="text-muted text-sm font-medium mb-2">Total Income</h3>
          <p className="text-2xl font-bold text-green-400">${totalIncome.toFixed(2)}</p>
        </div>
        <div className="bg-card rounded-lg p-6">
          <h3 className="text-muted text-sm font-medium mb-2">Total Expenses</h3>
          <p className="text-2xl font-bold text-red-400">${totalExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-card rounded-lg p-6">
          <h3 className="text-muted text-sm font-medium mb-2">Current Balance</h3>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${balance.toFixed(2)}
          </p>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">Monthly Spending Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#9AA5B1" opacity={0.2} />
              <XAxis dataKey="name" stroke="#F1F3F4" />
              <YAxis stroke="#F1F3F4" />
              <Tooltip contentStyle={{ backgroundColor: '#121A2A', borderColor: '#9AA5B1' }} />
              <Legend wrapperStyle={{ color: '#F1F3F4' }} />
              <Line type="monotone" dataKey="spending" stroke="#B39DDB" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">Spending by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={spendingByCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {spendingByCategory.map((entry, index) => (
                  <Pie key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 60%)`} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#121A2A', borderColor: '#9AA5B1' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Recent transactions */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#9AA5B1]/20">
                <th className="text-left py-3 px-4 text-[#9AA5B1]">Date</th>
                <th className="text-left py-3 px-4 text-[#9AA5B1]">Description</th>
                <th className="text-left py-3 px-4 text-[#9AA5B1]">Category</th>
                <th className="text-right py-3 px-4 text-[#9AA5B1]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.expenses.slice(0, 3).map(expense => (
                <tr key={expense.id} className="border-b border-[#9AA5B1]/10">
                  <td className="py-3 px-4">{expense.date}</td>
                  <td className="py-3 px-4">{expense.description}</td>
                  <td className="py-3 px-4">{expense.category}</td>
                  <td className="py-3 px-4 text-right text-red-400">-${expense.amount.toFixed(2)}</td>
                </tr>
              ))}
              {data.income.slice(0, 1).map(income => (
                <tr key={income.id} className="border-b border-[#9AA5B1]/10">
                  <td className="py-3 px-4">{income.date}</td>
                  <td className="py-3 px-4">{income.description}</td>
                  <td className="py-3 px-4">{income.source}</td>
                  <td className="py-3 px-4 text-right text-green-400">+${income.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Enhanced Expenses component
const Expenses = ({ data }) => {
  const [expenses, setExpenses] = useState(data.expenses);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentExpense, setCurrentExpense] = useState(null);
  const [newExpense, setNewExpense] = useState({
    date: '',
    description: '',
    category: '',
    amount: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  // Filtered and sorted expenses
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         expense.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === '' || expense.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort function
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Total of filtered expenses
  const totalFiltered = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Sort handler
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Add new expense
  const handleAddExpense = () => {
    if (!newExpense.date || !newExpense.description || !newExpense.category || !newExpense.amount) {
      alert('Please fill in all fields');
      return;
    }
    
    const expenseToAdd = {
      id: Date.now(),
      ...newExpense,
      amount: parseFloat(newExpense.amount)
    };
    
    setExpenses([...expenses, expenseToAdd]);
    setIsAddModalOpen(false);
    setNewExpense({ date: '', description: '', category: '', amount: '' });
  };

  // Edit expense
  const handleEditExpense = () => {
    if (!currentExpense.date || !currentExpense.description || !currentExpense.category || !currentExpense.amount) {
      alert('Please fill in all fields');
      return;
    }
    
    setExpenses(expenses.map(expense => 
      expense.id === currentExpense.id ? {...currentExpense, amount: parseFloat(currentExpense.amount)} : expense
    ));
    setIsEditModalOpen(false);
  };

  // Delete expense
  const handleDeleteExpense = (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      setExpenses(expenses.filter(expense => expense.id !== id));
    }
  };

  // Export CSV
  const exportToCSV = () => {
    const headers = 'Date,Description,Category,Amount\n';
    const csv = headers + filteredExpenses.map(expense => 
      `${expense.date},"${expense.description}",${expense.category},${expense.amount}`
    ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'expenses.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <div className="flex space-x-2">
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Add Expense
          </Button>
          <Button variant="secondary" onClick={exportToCSV}>
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-48">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-2.5 text-[#9AA5B1]" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-muted pl-10 pr-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
          </div>
          <div className="w-48">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
            >
              <option value="">All Categories</option>
              {data.categories.map((category, index) => (
                <option key={index} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[#9AA5B1]">Showing </span>
            <span className="font-medium">{filteredExpenses.length}</span>
            <span className="text-[#9AA5B1]"> of </span>
            <span className="font-medium">{expenses.length}</span>
            <span className="text-[#9AA5B1]"> expenses</span>
          </div>
          <div>
            <span className="text-[#9AA5B1]">Total: </span>
            <span className="font-medium text-red-400">${totalFiltered.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Expense Table */}
      <div className="bg-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#9AA5B1]/20">
                <th 
                  className="text-left py-3 px-4 text-[#9AA5B1] cursor-pointer"
                  onClick={() => requestSort('date')}
                >
                  <div className="flex items-center">
                    Date
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 text-[#9AA5B1] cursor-pointer"
                  onClick={() => requestSort('description')}
                >
                  <div className="flex items-center">
                    Description
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 text-[#9AA5B1] cursor-pointer"
                  onClick={() => requestSort('category')}
                >
                  <div className="flex items-center">
                    Category
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-4 text-[#9AA5B1] cursor-pointer"
                  onClick={() => requestSort('amount')}
                >
                  <div className="flex items-center justify-end">
                    Amount
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 text-[#9AA5B1]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedExpenses.length > 0 ? (
                sortedExpenses.map(expense => (
                  <tr key={expense.id} className="border-b border-[#9AA5B1]/10 hover:bg-[#1A2435]">
                    <td className="py-3 px-4">{expense.date}</td>
                    <td className="py-3 px-4">{expense.description}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-xs bg-[#2D3748] text-[#F1F3F4]">
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-red-400">${expense.amount.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setCurrentExpense(expense);
                            setIsEditModalOpen(true);
                          }}
                          className="text-[#9AA5B1] hover:text-white"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-[#9AA5B1] hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-[#9AA5B1]">
                    No expenses found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Expense"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Date</label>
            <input
              type="date"
              value={newExpense.date}
              onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Description</label>
            <input
              type="text"
              value={newExpense.description}
              onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              placeholder="What was this expense for?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Category</label>
            <select
              value={newExpense.category}
              onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
            >
              <option value="">Select Category</option>
              {data.categories.map((category, index) => (
                <option key={index} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newExpense.amount}
              onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddExpense}>
              Add Expense
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Expense"
      >
        {currentExpense && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Date</label>
              <input
                type="date"
                value={currentExpense.date}
                onChange={(e) => setCurrentExpense({...currentExpense, date: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Description</label>
              <input
                type="text"
                value={currentExpense.description}
                onChange={(e) => setCurrentExpense({...currentExpense, description: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Category</label>
              <select
                value={currentExpense.category}
                onChange={(e) => setCurrentExpense({...currentExpense, category: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              >
                {data.categories.map((category, index) => (
                  <option key={index} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentExpense.amount}
                onChange={(e) => setCurrentExpense({...currentExpense, amount: e.target.
                    t.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditExpense}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// Income component
const Income = ({ data }) => {
  const [income, setIncome] = useState(data.income);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentIncome, setCurrentIncome] = useState(null);
  const [newIncome, setNewIncome] = useState({
    date: '',
    description: '',
    source: '',
    amount: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  // Income sources list
  const sources = [...new Set(income.map(item => item.source))];

  // Filtered and sorted income
  const filteredIncome = income.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = filterSource === '' || item.source === filterSource;
    return matchesSearch && matchesSource;
  });

  // Sort function
  const sortedIncome = [...filteredIncome].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Total of filtered income
  const totalFiltered = filteredIncome.reduce((sum, item) => sum + item.amount, 0);

  // Sort handler
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Add new income
  const handleAddIncome = () => {
    if (!newIncome.date || !newIncome.description || !newIncome.source || !newIncome.amount) {
      alert('Please fill in all fields');
      return;
    }
    
    const incomeToAdd = {
      id: Date.now(),
      ...newIncome,
      amount: parseFloat(newIncome.amount)
    };
    
    setIncome([...income, incomeToAdd]);
    setIsAddModalOpen(false);
    setNewIncome({ date: '', description: '', source: '', amount: '' });
  };

  // Edit income
  const handleEditIncome = () => {
    if (!currentIncome.date || !currentIncome.description || !currentIncome.source || !currentIncome.amount) {
      alert('Please fill in all fields');
      return;
    }
    
    setIncome(income.map(item => 
      item.id === currentIncome.id ? {...currentIncome, amount: parseFloat(currentIncome.amount)} : item
    ));
    setIsEditModalOpen(false);
  };

  // Delete income
  const handleDeleteIncome = (id) => {
    if (window.confirm('Are you sure you want to delete this income?')) {
      setIncome(income.filter(item => item.id !== id));
    }
  };

  // Export CSV
  const exportToCSV = () => {
    const headers = 'Date,Description,Source,Amount\n';
    const csv = headers + filteredIncome.map(item => 
      `${item.date},"${item.description}",${item.source},${item.amount}`
    ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'income.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Income</h2>
        <div className="flex space-x-2">
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Add Income
          </Button>
          <Button variant="secondary" onClick={exportToCSV}>
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-48">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-2.5 text-[#9AA5B1]" />
              <input
                type="text"
                placeholder="Search income..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-muted pl-10 pr-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
          </div>
          <div className="w-48">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
            >
              <option value="">All Sources</option>
              {sources.map((source, index) => (
                <option key={index} value={source}>{source}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-[#9AA5B1]">Showing </span>
            <span className="font-medium">{filteredIncome.length}</span>
            <span className="text-[#9AA5B1]"> of </span>
            <span className="font-medium">{income.length}</span>
            <span className="text-[#9AA5B1]"> income entries</span>
          </div>
          <div>
            <span className="text-[#9AA5B1]">Total: </span>
            <span className="font-medium text-green-400">${totalFiltered.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Income Table */}
      <div className="bg-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#9AA5B1]/20">
                <th 
                  className="text-left py-3 px-4 text-[#9AA5B1] cursor-pointer"
                  onClick={() => requestSort('date')}
                >
                  <div className="flex items-center">
                    Date
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 text-[#9AA5B1] cursor-pointer"
                  onClick={() => requestSort('description')}
                >
                  <div className="flex items-center">
                    Description
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 text-[#9AA5B1] cursor-pointer"
                  onClick={() => requestSort('source')}
                >
                  <div className="flex items-center">
                    Source
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-4 text-[#9AA5B1] cursor-pointer"
                  onClick={() => requestSort('amount')}
                >
                  <div className="flex items-center justify-end">
                    Amount
                    <ArrowUpDown size={14} className="ml-1" />
                  </div>
                </th>
                <th className="text-right py-3 px-4 text-[#9AA5B1]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedIncome.length > 0 ? (
                sortedIncome.map(item => (
                  <tr key={item.id} className="border-b border-[#9AA5B1]/10 hover:bg-[#1A2435]">
                    <td className="py-3 px-4">{item.date}</td>
                    <td className="py-3 px-4">{item.description}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-xs bg-[#2D3748] text-[#F1F3F4]">
                        {item.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-green-400">${item.amount.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setCurrentIncome(item);
                            setIsEditModalOpen(true);
                          }}
                          className="text-[#9AA5B1] hover:text-white"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteIncome(item.id)}
                          className="text-[#9AA5B1] hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-[#9AA5B1]">
                    No income entries found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Income Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Income"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Date</label>
            <input
              type="date"
              value={newIncome.date}
              onChange={(e) => setNewIncome({...newIncome, date: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Description</label>
            <input
              type="text"
              value={newIncome.description}
              onChange={(e) => setNewIncome({...newIncome, description: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              placeholder="What was this income for?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Source</label>
            <input
              type="text"
              value={newIncome.source}
              onChange={(e) => setNewIncome({...newIncome, source: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              placeholder="Where did this income come from?"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newIncome.amount}
              onChange={(e) => setNewIncome({...newIncome, amount: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddIncome}>
              Add Income
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Income Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Income"
      >
        {currentIncome && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Date</label>
              <input
                type="date"
                value={currentIncome.date}
                onChange={(e) => setCurrentIncome({...currentIncome, date: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Description</label>
              <input
                type="text"
                value={currentIncome.description}
                onChange={(e) => setCurrentIncome({...currentIncome, description: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Source</label>
              <input
                type="text"
                value={currentIncome.source}
                onChange={(e) => setCurrentIncome({...currentIncome, source: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentIncome.amount}
                onChange={(e) => setCurrentIncome({...currentIncome, amount: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditIncome}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// Budgets component
const Budgets = ({ data }) => {
  const [budgets, setBudgets] = useState(data.budgets);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentBudget, setCurrentBudget] = useState(null);
  const [newBudget, setNewBudget] = useState({
    category: '',
    amount: '',
    period: 'Monthly'
  });

  // Calculate spending for each budget
  const budgetsWithSpending = budgets.map(budget => {
    const spending = data.expenses
      .filter(expense => expense.category === budget.category)
      .reduce((sum, expense) => sum + expense.amount, 0);
    
    const percentage = budget.amount > 0 ? (spending / budget.amount) * 100 : 0;
    
    return {
      ...budget,
      spending,
      percentage,
      remaining: budget.amount - spending
    };
  });

  // Add new budget
  const handleAddBudget = () => {
    if (!newBudget.category || !newBudget.amount) {
      alert('Please fill in all fields');
      return;
    }
    
    const budgetToAdd = {
      id: Date.now(),
      ...newBudget,
      amount: parseFloat(newBudget.amount)
    };
    
    setBudgets([...budgets, budgetToAdd]);
    setIsAddModalOpen(false);
    setNewBudget({ category: '', amount: '', period: 'Monthly' });
  };

  // Edit budget
  const handleEditBudget = () => {
    if (!currentBudget.category || !currentBudget.amount) {
      alert('Please fill in all fields');
      return;
    }
    
    setBudgets(budgets.map(budget => 
      budget.id === currentBudget.id ? {...currentBudget, amount: parseFloat(currentBudget.amount)} : budget
    ));
    setIsEditModalOpen(false);
  };

  // Delete budget
  const handleDeleteBudget = (id) => {
    if (window.confirm('Are you sure you want to delete this budget?')) {
      setBudgets(budgets.filter(budget => budget.id !== id));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Budgets</h2>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus size={16} className="mr-2" />
          Add Budget
        </Button>
      </div>

      {/* Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {budgetsWithSpending.map(budget => (
          <div key={budget.id} className="bg-card rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{budget.category}</h3>
              <span className="text-sm text-[#9AA5B1]">{budget.period}</span>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>${budget.spending.toFixed(2)} spent</span>
                <span>${budget.amount.toFixed(2)} budget</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full ${budget.percentage > 100 ? 'bg-red-500' : 'bg-purple'}`}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className={budget.percentage > 100 ? 'text-red-400' : ''}>
                  {budget.percentage.toFixed(0)}% used
                </span>
                <span className={budget.remaining < 0 ? 'text-red-400' : 'text-green-400'}>
                  ${budget.remaining.toFixed(2)} remaining
                </span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setCurrentBudget(budget);
                  setIsEditModalOpen(true);
                }}
                className="text-[#9AA5B1] hover:text-white"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDeleteBudget(budget.id)}
                className="text-[#9AA5B1] hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Budget Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Budget"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Category</label>
            <select
              value={newBudget.category}
              onChange={(e) => setNewBudget({...newBudget, category: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
            >
              <option value="">Select Category</option>
              {data.categories.map((category, index) => (
                <option key={index} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Budget Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newBudget.amount}
              onChange={(e) => setNewBudget({...newBudget, amount: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Period</label>
            <select
              value={newBudget.period}
              onChange={(e) => setNewBudget({...newBudget, period: e.target.value})}
              className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
            >
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
              <option value="Yearly">Yearly</option>
            </select>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBudget}>
              Add Budget
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Budget"
      >
        {currentBudget && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Category</label>
              <select
                value={currentBudget.category}
                onChange={(e) => setCurrentBudget({...currentBudget, category: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              >
                {data.categories.map((category, index) => (
                  <option key={index} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Budget Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentBudget.amount}
                onChange={(e) => setCurrentBudget({...currentBudget, amount: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#9AA5B1] mb-1">Period</label>
              <select
                value={currentBudget.period}
                onChange={(e) => setCurrentBudget({...currentBudget, period: e.target.value})}
                className="bg-muted px-4 py-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple"
              >
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditBudget}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

//Settings component
const defaultSettings = {
  currency: 'USD',
  notifications: {
    enabled: true,
    email: true,
    push: false,
    sms: false,
  },
  darkMode: true,
  autoBackup: false,
  language: 'en',
  profile: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 555-123-4567',
  },
  security: {
    passwordReset: true,
    twoFactorAuth: false,
    biometrics: false,
  },
};

const SettingsPage = ({ data }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [isEditing, setIsEditing] = useState(false);
  const [tempSettings, setTempSettings] = useState(defaultSettings);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true); // Example for demonstration

  // Load from local storage on component mount (optional)
  useEffect(() => {
    const savedSettings = localStorage.getItem('financeAppSettings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
        setTempSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
        // Optionally set an error message to display to the user
        setErrorMessage('Invalid settings data found. Please review your settings.');
      }
    }
  }, []);

  // Save to local storage whenever settings change (optional)
  useEffect(() => {
    localStorage.setItem('financeAppSettings', JSON.stringify(settings));
    setIsDarkMode(settings.darkMode); // Update dark mode state
  }, [settings]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith('notifications.')) {
      const notificationType = name.split('.')[1];
      setTempSettings({
        ...tempSettings,
        notifications: {
          ...tempSettings.notifications,
          [notificationType]: type === 'checkbox' ? checked : value,
        },
      });
    } else if (name.startsWith('profile.')) {
        const profileField = name.split('.')[1];
        setTempSettings({
          ...tempSettings,
          profile: {
            ...tempSettings.profile,
            [profileField]: value,
          }
        });
    } else if (name.startsWith('security.')) {
        const securityField = name.split('.')[1];
        setTempSettings({
          ...tempSettings,
          security: {
            ...tempSettings.security,
            [securityField]: type === 'checkbox' ? checked : value,
          }
        });
    } else {
      setTempSettings({ ...tempSettings, [name]: type === 'checkbox' ? checked : value });
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setTempSettings(settings);
    setSaveStatus('idle');
    setErrorMessage('');
  };

  const handleSave = () => {
    setSaveStatus('saving');
    // Simulate an async save operation
    setTimeout(() => {
      try {
        setSettings(tempSettings);
        setIsEditing(false);
        setSaveStatus('success');
        setErrorMessage('');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        setSaveStatus('error');
        setErrorMessage('Failed to save settings. Please try again.');
        setTimeout(() => setSaveStatus('idle'), 5000);
      }
    }, 1000);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveStatus('idle');
    setErrorMessage('');
  };

  return (
    <div style={{ padding: '24px', backgroundColor: isDarkMode ? '#1a202c' : '#f7fafc', minHeight: '100vh', color: isDarkMode ? '#f7fafc' : '#1a202c' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '32px', color: isDarkMode ? '#fff' : '#1a202c' }}>
        Settings
      </h1>

      {errorMessage && (
        <div
          style={{
            marginBottom: '16px',
            padding: '16px',
            backgroundColor: '#fecaca',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle style={{ height: '20px', width: '20px' }} />
          {errorMessage}
        </div>
      )}

      <div style={{ spaceY: '32px' }}>
        {/* Profile Settings */}
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 'semibold', marginBottom: '16px', color: isDarkMode ? '#edf2f7' : '#2d3748' }}>
            <User style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Profile
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label htmlFor="name" style={{ display: 'block', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  id="name"
                  name="profile.name"
                  value={tempSettings.profile.name}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid #4a5568' : '1px solid #d1d5db',
                    backgroundColor: isDarkMode ? '#2d3748' : '#fff',
                    color: isDarkMode ? '#fff' : '#2d3748',
                  }}
                />
              ) : (
                <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.profile.name}</p>
              )}
            </div>
            <div>
              <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                Email
              </label>
              {isEditing ? (
                <input
                  type="email"
                  id="email"
                  name="profile.email"
                  value={tempSettings.profile.email}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid #4a5568' : '1px solid #d1d5db',
                    backgroundColor: isDarkMode ? '#2d3748' : '#fff',
                    color: isDarkMode ? '#fff' : '#2d3748',
                  }}
                />
              ) : (
                <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.profile.email}</p>
              )}
            </div>
             <div>
              <label htmlFor="phone" style={{ display: 'block', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                Phone
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  id="phone"
                  name="profile.phone"
                  value={tempSettings.profile.phone}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid #4a5568' : '1px solid #d1d5db',
                    backgroundColor: isDarkMode ? '#2d3748' : '#fff',
                    color: isDarkMode ? '#fff' : '#2d3748',
                  }}
                />
              ) : (
                <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.profile.phone}</p>
              )}
            </div>
          </div>
        </section>

        {/* Currency Setting */}
        <div>
          <label htmlFor="currency" style={{ display: 'block', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
            Currency
          </label>
          {isEditing ? (
            <select
              id="currency"
              name="currency"
              value={tempSettings.currency}
              onChange={handleInputChange}
              style={{
                width: '180px',
                padding: '8px',
                borderRadius: '6px',
                border: isDarkMode ? '1px solid #4a5568' : '1px solid #d1d5db',
                backgroundColor: isDarkMode ? '#2d3748' : '#fff',
                color: isDarkMode ? '#fff' : '#2d3748',
              }}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="NGN">NGN (₦)</option>
              {/* Add more currencies as needed */}
            </select>
          ) : (
            <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.currency}</p>
          )}
        </div>

        {/* Notifications Settings */}
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 'semibold', marginBottom: '16px', color: isDarkMode ? '#edf2f7' : '#2d3748' }}>
            <Bell style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Notifications
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label htmlFor="notificationsEnabled" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                {isEditing ? (
                  <input
                    type="checkbox"
                    id="notificationsEnabled"
                    name="notifications.enabled"
                    checked={tempSettings.notifications.enabled}
                    onChange={handleInputChange}
                    style={{ height: '20px', width: '20px' }}
                  />
                ) : null}
                Enable All Notifications
              </label>
              {!isEditing && <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.notifications.enabled ? 'Enabled' : 'Disabled'}</p>}
            </div>

            <div>
              <label htmlFor="emailNotifications" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                {isEditing ? (
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    name="notifications.email"
                    checked={tempSettings.notifications.email}
                    onChange={handleInputChange}
                    style={{ height: '20px', width: '20px' }}
                  />
                ) : null}
                Email
              </label>
              {!isEditing && <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.notifications.email ? 'Enabled' : 'Disabled'}</p>}
            </div>

            <div>
              <label htmlFor="pushNotifications" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                {isEditing ? (
                  <input
                    type="checkbox"
                    id="pushNotifications"
                    name="notifications.push"
                    checked={tempSettings.notifications.push}
                    onChange={handleInputChange}
                    style={{ height: '20px', width: '20px' }}
                  />
                ) : null}
                Push Notifications
              </label>
              {!isEditing && <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.notifications.push ? 'Enabled' : 'Disabled'}</p>}
            </div>

            <div>
              <label htmlFor="smsNotifications" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                {isEditing ? (
                  <input
                    type="checkbox"
                    id="smsNotifications"
                    name="notifications.sms"
                    checked={tempSettings.notifications.sms}
                    onChange={handleInputChange}
                    style={{ height: '20px', width: '20px' }}
                  />
                ) : null}
                SMS Notifications
              </label>
              {!isEditing && <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.notifications.sms ? 'Enabled' : 'Disabled'}</p>}
            </div>
          </div>
        </section>

        {/* Security Settings */}
        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 'semibold', marginBottom: '16px', color: isDarkMode ? '#edf2f7' : '#2d3748' }}>
            <Lock style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Security
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label htmlFor="passwordReset" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                {isEditing ? (
                  <input
                    type="checkbox"
                    id="passwordReset"
                    name="security.passwordReset"
                    checked={tempSettings.security.passwordReset}
                    onChange={handleInputChange}
                    style={{ height: '20px', width: '20px' }}
                  />
                ) : null}
                Password Reset Enabled
              </label>
              {!isEditing && <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.security.passwordReset ? 'Enabled' : 'Disabled'}</p>}
            </div>
            <div>
              <label htmlFor="twoFactorAuth" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                {isEditing ? (
                  <input
                    type="checkbox"
                    id="twoFactorAuth"
                    name="security.twoFactorAuth"
                    checked={tempSettings.security.twoFactorAuth}
                    onChange={handleInputChange}
                    style={{ height: '20px', width: '20px' }}
                  />
                ) : null}
                Two-Factor Authentication
              </label>
              {!isEditing && <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.security.twoFactorAuth ? 'Enabled' : 'Disabled'}</p>}
            </div>
             <div>
              <label htmlFor="biometrics" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
                {isEditing ? (
                  <input
                    type="checkbox"
                    id="biometrics"
                    name="security.biometrics"
                    checked={tempSettings.security.biometrics}
                    onChange={handleInputChange}
                    style={{ height: '20px', width: '20px' }}
                  />
                ) : null}
                Biometrics
              </label>
              {!isEditing && <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.security.biometrics ? 'Enabled' : 'Disabled'}</p>}
            </div>
          </div>
        </section>

        {/* Dark Mode Setting */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label htmlFor="dark-mode" style={{ color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
            <Moon style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Dark Mode
          </label>
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="dark-mode"
                name="darkMode"
                checked={tempSettings.darkMode}
                onChange={handleInputChange}
                style={{ height: '20px', width: '20px' }}
              />
            </div>
          ) : (
            <span style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.darkMode ? 'Enabled' : 'Disabled'}</span>
          )}
        </div>

        {/* Language Setting */}
        <div>
          <label htmlFor="language" style={{ display: 'block', marginBottom: '8px', color: isDarkMode ? '#cbd5e0' : '#4a5568' }}>
            <Languages style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Language
          </label>
          {isEditing ? (
            <select
              id="language"
              name="language"
              value={tempSettings.language}
              onChange={handleInputChange}
              style={{
                width: '180px',
                padding: '8px',
                borderRadius: '6px',
                border: isDarkMode ? '1px solid #4a5568' : '1px solid #d1d5db',
                backgroundColor: isDarkMode ? '#2d3748' : '#fff',
                color: isDarkMode ? '#fff' : '#2d3748',
              }}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              {/* Add more languages as needed */}
            </select>
          ) : (
            <p style={{ color: isDarkMode ? '#fff' : '#6b7280' }}>{settings.language}</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
        {isEditing ? (
          <>
            <button
              onClick={handleCancel}
              disabled={saveStatus === 'saving'}
              style={{
                backgroundColor: 'transparent',
                border: isDarkMode ? '1px solid #4a5568' : '1px solid #d1d5db',
                padding: '8px 16px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                color: isDarkMode ? '#fff' : '#374151',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: isDarkMode ? '#374151' : '#edf2f7',
                },
              }}
            >
              <XCircle style={{ height: '20px', width: '20px' }} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: '#2563eb',
                },
              }}
            >
              {saveStatus === 'saving' ? (
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : saveStatus === 'success' ? (
                <CheckCircle style={{ height: '20px', width: '20px', color: '#16a34a' }} />
              ) : (
                <SaveIcon style={{ height: '20px', width: '20px' }} />
              )}
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save'}
            </button>
          </>
        ) : (
          <button
            onClick={handleEdit}
            style={{
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: '#2563eb',
              },
            }}
          >
            Edit Settings
          </button>
        )}
      </div>
    </div>
  );
};


// Placeholder component for other pages
const PlaceholderPage = ({ title }) => {
  console.log("Rendering placeholder for:", title); // Debug line
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">{title}</h2>
      <div className="bg-card rounded-lg p-6 flex items-center justify-center h-64">
        <p className="text-[#9AA5B1]">This {title.toLowerCase()} section would be implemented in a real application</p>
      </div>
    </div>
  );
};

const App = () => {
  const [data, setData] = useState(initialData);

  return (
    <Router>
      <div className="flex h-screen bg-[#121A2A] text-light">
        {/* Sidebar with navigation */}
        <Sidebar data={data} />

        {/* Main content area */}
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard data={data} />} />
            <Route path="/expenses" element={<Expenses data={data} />} />
            <Route path="/income" element={<Income data={data} />} />
            <Route path="/budgets" element={<Budgets data={data} />} />
            <Route path="/reports" element={<PlaceholderPage title="Reports" />} />
            <Route path="/settings" element={<SettingsPage data={data} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;