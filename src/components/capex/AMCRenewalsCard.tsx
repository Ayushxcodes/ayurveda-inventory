"use client";

export default function AMCRenewalsCard(){
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">AMC renewals due</span><a className="view-link">View report →</a></div>
      <div className="card-body">
        <table className="amc-table">
          <thead>
            <tr><th>Item &amp; location</th><th>Vendor</th><th style={{ textAlign: 'right' }}>Due in</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="item-name">AC Unit</div>
                <div className="item-loc">OPD Room 3</div>
                <div className="mini-bar-wrap"><div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: '42%', background: '#E24B4A' }}></div></div></div>
              </td>
              <td><div className="vendor-txt">Cool Air Services</div></td>
              <td style={{ textAlign: 'right' }}><span className="pill pill-red">38 days</span></td>
            </tr>
            <tr>
              <td>
                <div className="item-name">BP Monitor</div>
                <div className="item-loc">Ward B</div>
                <div className="mini-bar-wrap"><div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: '58%', background: '#EF9F27' }}></div></div></div>
              </td>
              <td><div className="vendor-txt">MedEquip Co.</div></td>
              <td style={{ textAlign: 'right' }}><span className="pill pill-amber">52 days</span></td>
            </tr>
            <tr>
              <td>
                <div className="item-name">Water Purifier</div>
                <div className="item-loc">Pharmacy</div>
                <div className="mini-bar-wrap"><div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: '64%', background: '#EF9F27' }}></div></div></div>
              </td>
              <td><div className="vendor-txt">AquaCare Ltd.</div></td>
              <td style={{ textAlign: 'right' }}><span className="pill pill-amber">58 days</span></td>
            </tr>
            <tr>
              <td>
                <div className="item-name">Geyser</div>
                <div className="item-loc">IPD Ward A</div>
                <div className="mini-bar-wrap"><div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: '100%', background: 'var(--green)' }}></div></div></div>
              </td>
              <td><div className="vendor-txt">HeatPro Services</div></td>
              <td style={{ textAlign: 'right' }}><span className="pill pill-green">90 days</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="card-foot"><span className="foot-txt">Total AMC contracts &nbsp;<strong>18</strong></span><span className="foot-txt" style={{ color: 'var(--red)' }}>Already expired &nbsp;<strong>1</strong></span></div>
    </div>
  );
}
