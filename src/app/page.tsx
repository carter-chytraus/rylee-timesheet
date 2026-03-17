"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MonthData {
  month: number;
  year: number;
  monthName: string;
  totalHours: number;
  payRate: number;
  wages: number;
  reimbursements: number;
  total: number;
  isPaid: boolean;
  settingId?: string;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthData, setMonthData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRate, setEditingRate] = useState<number | null>(null);
  const [newRate, setNewRate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, reimbRes, settingsRes] = await Promise.all([
        fetch(`/api/time-entries?year=${year}`),
        fetch(`/api/reimbursements?year=${year}`),
        fetch("/api/monthly-settings"),
      ]);

      const entries = await entriesRes.json();
      const reimbursements = await reimbRes.json();
      const settings = await settingsRes.json();

      const data: MonthData[] = [];

      for (let m = 1; m <= 12; m++) {
        const monthEntries = Array.isArray(entries)
          ? entries.filter((e: { date: string }) => {
              const d = new Date(e.date);
              return d.getMonth() + 1 === m && d.getFullYear() === year;
            })
          : [];

        const monthReimb = Array.isArray(reimbursements)
          ? reimbursements.filter((r: { date: string }) => {
              const d = new Date(r.date);
              return d.getMonth() + 1 === m && d.getFullYear() === year;
            })
          : [];

        const setting = Array.isArray(settings)
          ? settings.find(
              (s: { year: number; month: number }) => s.year === year && s.month === m
            )
          : null;

        const totalMinutes = monthEntries.reduce(
          (sum: number, e: { durationMin: number }) => sum + e.durationMin,
          0
        );
        const totalHours = totalMinutes / 60;
        const payRate = setting?.payRate ?? 20;
        const wages = totalHours * payRate;
        const reimbTotal = monthReimb.reduce(
          (sum: number, r: { amount: number }) => sum + r.amount,
          0
        );

        data.push({
          month: m,
          year,
          monthName: MONTH_NAMES[m - 1],
          totalHours: Math.round(totalHours * 100) / 100,
          payRate,
          wages: Math.round(wages * 100) / 100,
          reimbursements: Math.round(reimbTotal * 100) / 100,
          total: Math.round((wages + reimbTotal) * 100) / 100,
          isPaid: setting?.isPaid ?? false,
          settingId: setting?.id,
        });
      }

      setMonthData(data);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function togglePaid(m: MonthData) {
    await fetch("/api/monthly-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: m.year, month: m.month, isPaid: !m.isPaid }),
    });
    fetchData();
  }

  async function saveRate(m: MonthData) {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate <= 0) return;
    await fetch("/api/monthly-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: m.year, month: m.month, payRate: rate }),
    });
    setEditingRate(null);
    setNewRate("");
    fetchData();
  }

  const annualWages = monthData.reduce((s, m) => s + m.wages, 0);
  const annualReimb = monthData.reduce((s, m) => s + m.reimbursements, 0);
  const annualTotal = annualWages + annualReimb;
  const annualHours = monthData.reduce((s, m) => s + m.totalHours, 0);

  const chartData = monthData
    .filter((m) => m.wages > 0 || m.reimbursements > 0)
    .map((m) => ({
      name: m.monthName,
      Wages: m.wages,
      Reimbursements: m.reimbursements,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Total Hours</p>
          <p className="text-2xl font-bold text-slate-900">{annualHours.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Wages</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(annualWages)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Reimbursements</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(annualReimb)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500">Annual Total</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(annualTotal)}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Monthly Trends</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="Wages" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Reimbursements" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Month</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Hours</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Rate</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Wages</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Reimbursements</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Paid</th>
              </tr>
            </thead>
            <tbody>
              {monthData.map((m) => (
                <tr
                  key={m.month}
                  className={`border-b border-slate-100 ${
                    m.isPaid ? "bg-emerald-50/50" : m.total > 0 ? "bg-amber-50/50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {MONTH_NAMES[m.month - 1]} {m.year}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {m.totalHours > 0 ? m.totalHours.toFixed(1) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingRate === m.month && session?.user.role === "ADMIN" ? (
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          value={newRate}
                          onChange={(e) => setNewRate(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveRate(m)}
                          className="w-16 border border-slate-300 rounded px-1 py-0.5 text-right text-sm"
                          autoFocus
                        />
                        <button onClick={() => saveRate(m)} className="text-indigo-600 text-xs">Save</button>
                        <button onClick={() => setEditingRate(null)} className="text-slate-400 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <span
                        className={session?.user.role === "ADMIN" ? "cursor-pointer hover:text-indigo-600" : ""}
                        onClick={() => {
                          if (session?.user.role === "ADMIN") {
                            setEditingRate(m.month);
                            setNewRate(m.payRate.toString());
                          }
                        }}
                      >
                        ${m.payRate}/hr
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-indigo-700 font-medium">
                    {m.wages > 0 ? formatCurrency(m.wages) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700">
                    {m.reimbursements > 0 ? formatCurrency(m.reimbursements) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {m.total > 0 ? formatCurrency(m.total) : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.total > 0 && (
                      <input
                        type="checkbox"
                        checked={m.isPaid}
                        onChange={() => togglePaid(m)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    )}
                  </td>
                </tr>
              ))}
              {/* Annual totals row */}
              <tr className="bg-slate-100 font-semibold">
                <td className="px-4 py-3 text-slate-900">Annual Total</td>
                <td className="px-4 py-3 text-right text-slate-900">{annualHours.toFixed(1)}</td>
                <td className="px-4 py-3 text-right text-slate-500">-</td>
                <td className="px-4 py-3 text-right text-indigo-700">{formatCurrency(annualWages)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(annualReimb)}</td>
                <td className="px-4 py-3 text-right text-slate-900">{formatCurrency(annualTotal)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
