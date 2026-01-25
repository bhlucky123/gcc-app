import * as Sharing from "expo-sharing";
import RNHTMLtoPDF from "react-native-html-to-pdf";

const handleExportPDF = async () => {
    if (!data?.result?.length) return;

    const htmlContent = `
    <h1>Sales Report</h1>
    <p><strong>Draw:</strong> ${selectedDraw?.name || ""}</p>
    <p><strong>Date:</strong> ${formatDateDDMMYYYY(fromDate)} - ${formatDateDDMMYYYY(toDate)}</p>
    <table border="1" cellpadding="5" cellspacing="0" width="100%">
      <thead>
        <tr>
          <th>Date</th>
          <th>Dealer</th>
          <th>Bill No.</th>
          <th>Count</th>
          <th>Dealer Amt</th>
          <th>Customer Amt</th>
        </tr>
      </thead>
      <tbody>
        ${data.result
            .map((item) => {
                const date = formatDateDDMMYYYY(new Date(item.date_time));
                const dealer = item.dealer?.username ?? "";
                return `
              <tr>
                <td>${date}</td>
                <td>${dealer}</td>
                <td>${item.bill_number}</td>
                <td>${item.bill_count}</td>
                <td>${item.dealer_amount.toFixed(2)}</td>
                <td>${item.customer_amount.toFixed(2)}</td>
              </tr>
            `;
            })
            .join("")}
      </tbody>
    </table>
    <p><strong>Total Dealer Amount:</strong> ${data.total_dealer_amount}</p>
    <p><strong>Total Customer Amount:</strong> ${data.total_customer_amount}</p>
  `;

    const file = await RNHTMLtoPDF.convert({
        html: htmlContent,
        fileName: "sales-report",
        base64: false,
    });

    if (file.filePath) {
        await Sharing.shareAsync(file.filePath);
    }
};
