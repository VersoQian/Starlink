'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
export const parseCsv = (input) => {
    const lines = input
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (lines.length === 0) {
        return { headers: [], rows: [] };
    }
    const tokenize = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"' && line[i - 1] !== '\\') {
                inQuotes = !inQuotes;
                continue;
            }
            if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        if (current.length > 0) {
            result.push(current.trim());
        }
        return result;
    };
    const headers = tokenize(lines[0]);
    const rows = lines.slice(1).map((line) => tokenize(line));
    return {
        headers,
        rows
    };
};
const parseExcel = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target?.result);
                const workbook = XLSX.read(data, { type: 'array' });
                if (workbook.SheetNames.length === 0) {
                    reject(new Error('Excel文件中没有找到工作表'));
                    return;
                }
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (jsonData.length === 0) {
                    reject(new Error('Excel文件为空'));
                    return;
                }
                const headers = (jsonData[0] || []).map((h) => String(h));
                const rows = jsonData.slice(1).map((row) => row.map((cell) => String(cell)));
                resolve({ headers, rows });
            }
            catch (error) {
                reject(new Error('Excel解析失败，请确保文件格式正确'));
            }
        };
        reader.onerror = () => {
            reject(new Error('文件读取失败'));
        };
        reader.readAsArrayBuffer(file);
    });
};
const toMarkdown = ({ headers, rows }) => {
    if (headers.length === 0)
        return '';
    const headerLine = `| ${headers.join(' | ')} |`;
    const divider = `| ${headers.map(() => '---').join(' | ')} |`;
    const body = rows.map((row) => `| ${row.map((value) => value ?? '').join(' | ')} |`).join('\n');
    return [headerLine, divider, body].filter(Boolean).join('\n');
};
const toCsv = ({ headers, rows }) => {
    if (headers.length === 0)
        return '';
    const escape = (value) => {
        if (value.includes(',') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    };
    const headerLine = headers.map(escape).join(',');
    const body = rows.map((row) => row.map((cell) => escape(cell ?? '')).join(',')).join('\n');
    return [headerLine, body].filter(Boolean).join('\n');
};
export function DataVisualizer({ title = '社群数据可视化', description = '上传 CSV 或粘贴表格内容，快速生成可分享的表格视图并导出。', onDataExtracted }) {
    const [rawInput, setRawInput] = useState('');
    const [table, setTable] = useState({ headers: [], rows: [] });
    const [error, setError] = useState(null);
    const rowCount = useMemo(() => table.rows.length, [table.rows.length]);
    const handleParse = (content) => {
        try {
            const parsed = parseCsv(content);
            setTable(parsed);
            setError(null);
            if (onDataExtracted) {
                onDataExtracted(parsed);
            }
        }
        catch (cause) {
            setError(cause?.message ?? '解析失败，请检查格式');
        }
    };
    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        // 文件大小限制：5MB
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            setError(`文件过大（${(file.size / 1024 / 1024).toFixed(2)}MB），请上传小于5MB的文件`);
            event.target.value = '';
            return;
        }
        try {
            // 判断文件类型
            const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('spreadsheet');
            if (isExcel) {
                // Excel文件处理
                const parsed = await parseExcel(file);
                setTable(parsed);
                setError(null);
                if (onDataExtracted) {
                    onDataExtracted(parsed);
                }
                // 更新rawInput显示
                setRawInput(`[已上传Excel: ${file.name}, ${(file.size / 1024).toFixed(1)}KB]`);
            }
            else {
                // CSV文件处理
                const reader = new FileReader();
                reader.onload = () => {
                    const text = typeof reader.result === 'string' ? reader.result : '';
                    setRawInput(text);
                    handleParse(text);
                };
                reader.readAsText(file, 'utf-8');
            }
        }
        catch (error) {
            setError(error instanceof Error ? error.message : '文件解析失败');
        }
        // 清空input，允许重复上传同一文件
        event.target.value = '';
    };
    const handleAnalyzeClick = () => {
        if (!rawInput.trim()) {
            setError('请先上传文件或粘贴表格内容');
            return;
        }
        handleParse(rawInput);
    };
    const handleDownload = (kind) => {
        const blob = new Blob([kind === 'csv' ? toCsv(table) : toMarkdown(table)], {
            type: kind === 'csv' ? 'text/csv;charset=utf-8;' : 'text/plain;charset=utf-8;'
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = kind === 'csv' ? 'visualized-data.csv' : 'visualized-data.md';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    return (_jsxs("div", { className: "flex h-full flex-1 flex-col gap-6 overflow-hidden p-6", children: [_jsxs("div", { className: "rounded-3xl border border-[#D7DBFF] bg-white/90 p-6 shadow-sm", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-slate-900", children: title }), _jsx("p", { className: "mt-2 text-sm text-slate-500", children: description })] }), _jsxs("label", { className: "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-2 text-sm text-[#4338CA] transition hover:border-[#A5B4FC] hover:bg-[#E0E7FF]", children: ["\u4E0A\u4F20 CSV/Excel", _jsx("input", { type: "file", accept: ".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel", className: "hidden", onChange: handleFileChange })] })] }), _jsx("textarea", { value: rawInput, onChange: (event) => setRawInput(event.target.value), placeholder: "\u7C98\u8D34\u6570\u636E\uFF0C\u4F8B\u5982\uFF1A\u540D\u79F0,\u6570\u503C\n\u5317\u533A,120\n\u5357\u533A,90", className: "mt-4 h-40 w-full rounded-2xl border border-[#E0E2FF] bg-white px-4 py-3 text-sm text-slate-600 placeholder:text-slate-400 focus:border-[#A5B4FC] focus:outline-none" }), error ? (_jsx("p", { className: "mt-3 rounded-xl border border-[#F87171] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]", children: error })) : (_jsx("p", { className: "mt-3 text-xs text-slate-400", children: "\u652F\u6301 CSV \u548C Excel (.xlsx, .xls) \u4E0A\u4F20\u6216\u7C98\u8D34\uFF0C\u4F7F\u7528\u534A\u89D2\u9017\u53F7\u5206\u9694\u5217\u3002" })), _jsxs("div", { className: "mt-4 flex flex-wrap gap-3", children: [_jsx("button", { type: "button", onClick: handleAnalyzeClick, className: "rounded-xl bg-gradient-to-r from-[#7F5BFA] to-[#6350E8] px-4 py-2 text-sm font-medium text-white shadow-md hover:from-[#6F4EE5] hover:to-[#5645D7]", children: "\u89E3\u6790\u5185\u5BB9\u5E76\u53EF\u89C6\u5316" }), _jsx("button", { type: "button", onClick: () => {
                                    const exampleData = '产品,销量,增长率\n手机,250,15%\n电脑,180,8%\n平板,120,-5%\n耳机,95,22%\n手表,65,30%';
                                    setRawInput(exampleData);
                                    handleParse(exampleData);
                                }, className: "rounded-xl border-2 border-[#7F5BFA] bg-white px-4 py-2 text-sm font-medium text-[#7F5BFA] transition hover:bg-[#F8F9FF]", children: "\u52A0\u8F7D\u793A\u4F8B\u6570\u636E" }), _jsx("button", { type: "button", disabled: rowCount === 0, onClick: () => handleDownload('csv'), className: clsx('rounded-xl border border-[#D7DBFF] px-4 py-2 text-sm text-slate-600 transition', rowCount === 0 ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#EEF0FF]'), children: "\u4E0B\u8F7D CSV" }), _jsx("button", { type: "button", disabled: rowCount === 0, onClick: () => handleDownload('markdown'), className: clsx('rounded-xl border border-[#D7DBFF] px-4 py-2 text-sm text-slate-600 transition', rowCount === 0 ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#EEF0FF]'), children: "\u4E0B\u8F7D Markdown" }), _jsx("button", { type: "button", onClick: () => {
                                    setRawInput('');
                                    setTable({ headers: [], rows: [] });
                                    setError(null);
                                }, className: "rounded-xl border border-[#D7DBFF] px-4 py-2 text-sm text-slate-500 transition hover:bg-white", children: "\u6E05\u7A7A" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden rounded-3xl border border-[#D7DBFF] bg-white/85 shadow-inner", children: [_jsxs("div", { className: "flex items-center justify-between border-b border-[#E3E6FF] px-5 py-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-slate-800", children: "\u6570\u636E\u9884\u89C8" }), _jsx("p", { className: "text-xs text-slate-500", children: rowCount > 0 ? `共 ${rowCount} 行 · ${table.headers.length} 列` : '等待上传或粘贴数据' })] }), rowCount > 0 && (_jsx("span", { className: "rounded-full bg-[#EEF2FF] px-3 py-1 text-xs text-[#4338CA]", children: "\u9884\u89C8\u6700\u65B0" }))] }), _jsx("div", { className: "flex-1 overflow-auto", children: rowCount === 0 ? (_jsx("div", { className: "flex h-full items-center justify-center px-6 text-sm text-slate-400", children: "\u6682\u65E0\u6570\u636E\uFF0C\u4E0A\u4F20\u6587\u4EF6\u6216\u7C98\u8D34\u5185\u5BB9\u5373\u53EF\u81EA\u52A8\u751F\u6210\u8868\u683C\u89C6\u56FE\u3002" })) : (_jsxs("table", { className: "min-w-full border-separate border-spacing-0 text-sm text-slate-700", children: [_jsx("thead", { className: "sticky top-0 bg-[#F5F6FF]", children: _jsx("tr", { children: table.headers.map((header) => (_jsx("th", { className: "border-b border-[#E3E6FF] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500", children: header || '-' }, header))) }) }), _jsx("tbody", { children: table.rows.map((row, rowIndex) => (_jsx("tr", { className: "odd:bg-white even:bg-[#F9FAFF]", children: table.headers.map((_, columnIndex) => (_jsx("td", { className: "border-b border-[#EEF0FF] px-4 py-2 text-xs text-slate-600", children: row[columnIndex] ?? '' }, `row-${rowIndex}-col-${columnIndex}`))) }, `row-${rowIndex}`))) })] })) })] })] }));
}
