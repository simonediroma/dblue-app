export default function checkinReminderEmail(name: string) {
  const template = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>[DEEPBLUE] Check-in Reminder</title>
  </head>
  <body>
    <div
      style="
        width: 100%;
        height: 100%;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        color: #3d424a;
      "
    >
      <div style="width: 700px; border: 1px solid #d9d9d9">
        <table style="border-collapse: collapse; width: 100%">
          <tbody>
            <tr
              style="
                width: 100%;
                border-bottom: 1px solid #d9d9d9;
                background-color: white;
              "
            >
              <td style="text-align: center; padding: 10px">
                <img
                  style="width: auto; height: 40px"
                  src="https://tools.dblue.it/public/dbluetextlogo.png"
                  alt="Deepblue company logo"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <div style="width: 100%; box-sizing: border-box; padding: 15px">
          <p style="color: #3d424a; font-size: 20px; font-weight: bold">Hi ${name},</p>
          <p style="color: #3d424a">
            You've booked your spot in the office for today but we noticed you
            haven't checked-in yet 🙂
          </p>
          <p style="color: #3d424a">
            Please visit the office app website or click the button below to
            check in.
          </p>
          <a
            href="https://tools.dblue.it/dashboard"
            target="_blank"
            style="
              display: inline-block;
              width: 130px; /* Adjusted width to fit padding */
              height: 43px; /* Adjusted height to fit padding */
              line-height: 43px; /* Vertically centers text */
              background-color: white;
              border: 1px solid grey;
              border-radius: 30px;
              text-align: center;
              text-decoration: none;
              color: black;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 13px;
            "
          >
            <!-- The content goes inside the <a> tag -->
            <img
              style="
                width: auto;
                height: 20px;
                vertical-align: middle;
                margin-right: 4px;
                margin-bottom: 2px; /* Small adjustment for perfect centering */
              "
              src="https://tools.dblue.it/public/dbluelogo.png"
              alt="Deepblue company logo"
            />
            <span style="vertical-align: middle">Office App</span>
          </a>
          <br />

          <div style="margin-top: 10px">
            <span>Thank you</span>
          </div>
          <div style="margin-top: 5px">
            <span style="font-weight: bold">Deepblue Tech</span>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>

`;
  return template;
}
