"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import MultiSelect from "@/components/MultiSelect";
import { REIMBURSEMENT_TAGS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface Reimbursement {
  id: string;
  date: string;
  amount: number;
  description: string;
  tags: string[];
  user: { name: string };
}

type ViewMode = "month" | "dateRange" | "all";

export default function ReimbursementsPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(2025);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "EMPLOYEE";

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();

    if (viewMode === "month") {
      params.set("month", month.toString());
      params.set("year", year.toString());
    } else if (viewMode === "dateRange") {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    }

    if (search) params.set("search", search);
    if (filterTags.length > 0) params.set("tags", filterTags.join(","));

    const res = await fetch(`/api/reimbursements?${params}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [viewMode, month, year, startDate, endDate, search, filterTags]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function openAdd() {
    setEditingId(null);
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormAmount("");
    setFormDesc("");
    setFormTags([]);
    setModalOpen(true);
  }

  function openEdit(item: Reimbursement) {
    setEditingId(item.id);
    setFormDate(format(new Date(item.date), "yyyy-MM-dd"));
    setFormAmount(item.amount.toString());
    setFormDesc(item.description || "");
    setFormTags(item.tags || []);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const body = {
      date: formDate,
      amount: formAmount,
      description: formDesc,
      tags: formTags,
    };

    const url = editingId ? `/api/reimbursements/${editingId}` : "/api/reimbursements";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      showToast(editingId ? "Reimbursement updated" : "Reimbursement added");
      setModalOpen(false);
      fetchItems();
    } else {
      showToast("Error saving reimbursement");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/reimbursements/${deleteId}`, { method: "DELETE" });
    showToast("Reimbursement deleted");
    setDeleteId(null);
    fetchItems();
  }

  function clearFilters() {
    setSearch("");
    setFilterTags([]);
    setStartDate("");
    setEndDate("");
    setViewMode("month");
    setMonth(new Date().getMonth() + 1);
    setYear(2025);
  }

  const totalAmount = items.reduce((s, r) => s + r.amount, 0);
  const hasActiveFilters = search || filterTags.length > 0 || viewMode !== "month";

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-20 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Reimbursements</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showFilters || hasActiveFilters
                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Filters {hasActiveFilters && `(active)`}
          </button>
          {canEdit && (
            <button
              onClick={openAdd}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              + Add Reimbursement
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          {/* View Mode Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {([
              ["month", "Month"],
              ["dateRange", "Date Range"],
              ["all", "All Time"],
            ] as [ViewMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            {viewMode === "month" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Month</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {format(new Date(2024, i, 1), "MMMM")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {[2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {viewMode === "dateRange" && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search descriptions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-48"
              />
            </div>

            <div className="min-w-[200px]">
              <label className="block text-xs font-medium text-slate-500 mb-1">Filter by Tags</label>
              <MultiSelect
                options={REIMBURSEMENT_TAGS}
                selected={filterTags}
                onChange={setFilterTags}
                placeholder="Any tag..."
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-slate-500 hover:text-slate-700 underline pb-2"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-4">
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <span className="text-sm text-slate-500">Count: </span>
          <span className="font-semibold">{items.length}</span>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
          <span className="text-sm text-slate-500">Total: </span>
          <span className="font-semibold text-emerald-700">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No reimbursements found.{" "}
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-indigo-600 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tags</th>
                  {canEdit && (
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900 whitespace-nowrap">
                      {format(new Date(item.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Reimbursement" : "Add Reimbursement"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
            <MultiSelect
              options={REIMBURSEMENT_TAGS}
              selected={formTags}
              onChange={setFormTags}
              placeholder="Select category..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="What was this for?"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Update" : "Add Reimbursement"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Reimbursement"
        message="Are you sure you want to delete this reimbursement? This action cannot be undone."
      />
    </div>
  );
}
