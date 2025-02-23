# faceid-mysql

This project demonstrates a face recognition system using face-api.js on the client-side with a Node.js/Express server 
and a MySQL database for storing face embeddings and user information. It features auto-matching capabilities and performs a liveness check.

## Technologies Used

*   **Client-side:**
    *   HTML
    *   JavaScript
    *   face-api.js
*   **Server-side:**
    *   Node.js
    *   Express
    *   MySQL
    *   body-parser

## Setup Instructions

### Prerequisites

*   Node.js and npm installed
*   MySQL database server installed
*   A webcam

### Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository_url>
    cd abhi8170-faceid-mysql
    ```

2.  **Install server dependencies:**

    ```bash
    cd server
    npm install
    ```

3.  **Configure MySQL Database:**

    *   Create a database named `face_db` in your MySQL server.
    *   Modify the `server/server.js` file with your MySQL connection details.

    ```javascript
    const dbConfig = {
      host: 'localhost',
      user: 'root',         // Change if needed
      password: 'your_password', // Change if needed
      database: 'face_db',  // Ensure this DB exists
      socketPath: '/var/run/mysqld/mysqld.sock' // Uncomment/adjust if needed
    };
    ```

    Replace `'your_password'` with your actual MySQL password.  Adjust socketPath if necessary.

4.  **Start the server:**

    ```bash
    node server.js
    ```

5.  **Open the client application:**

    Open `client/index.html` in your browser.

## Usage

1.  **Access the application:**

    Navigate to `http://localhost:3000` in your web browser.

2.  **Register:**

    Click the "Register" button to open the registration modal.
    Enter a username and ensure your face is clearly visible in the camera feed.
    Click "Submit" to register your face.

3.  **Auto-Match:**

    The application will continuously analyze the video feed for faces.
    If a matching face is found in the database, the match preview will display the user's name and a similarity score.

## Important Considerations

*   **Model Loading:** The `script.js` file loads the face-api.js models from the `./models` directory. Ensure that the paths in the `MODEL_URL` variable are correct.
*   **Security:** This is a basic demonstration and is not intended for production use.  Considerations for a production system:
    *   **Authentication:** Implement secure authentication for registration.
    *   **Database Security:**  Protect your database credentials and consider using prepared statements to prevent SQL injection.
    *   **HTTPS:** Serve the application over HTTPS.
    *   **Liveness Detection:** The provided liveness check is basic.  Implement more robust liveness detection to prevent spoofing.
*   **Privacy:**  Be mindful of privacy considerations when storing facial data.  Obtain explicit consent and adhere to relevant data protection regulations.

## Known Issues

*   The application might not work correctly if multiple faces are visible in the camera feed.
*   Face matching accuracy depends heavily on the quality of the face embeddings and lighting conditions.
