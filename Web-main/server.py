from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import psycopg2
from werkzeug.security import check_password_hash

app = Flask(__name__)
CORS(app)

def get_db_connection():
    return psycopg2.connect(
        host="aws-1-ap-northeast-2.pooler.supabase.com",
        port=5432,
        user="postgres.dusubxmflzjyshtfoxmd",
        password="SmartATTSystem123",
        dbname="postgres"
    )


@app.route("/testdb")
def testdb():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT version()")
        version = cur.fetchone()

        cur.close()
        conn.close()

        return {
            "success": True,
            "version": version[0]
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }, 500
# -----------------------------
# LOGIN
# -----------------------------
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "success": False,
                "message": "No data received"
            }), 400

        username = str(data.get('username', '')).strip()
        password = str(data.get('password', '')).strip()

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                r.roleid,
                r.rolename,
                e.eid,
                u.username,
                u.passwordhash
            FROM useraccount u
            JOIN entity e
                ON u.eid = e.eid
            JOIN role r
                ON e.roleid = r.roleid
            WHERE u.username = %s
        """, (username,))

        user = cursor.fetchone()

        print("LOGIN ATTEMPT")
        print("Username:", username)
        print("Password:", password)
        print("DB Result:", user)

        if not user:
            return jsonify({
                "success": False,
                "message": "User not found"
            }), 401

        if not check_password_hash(user[4], password):
            print(check_password_hash(user[4], password))
            return jsonify({
                "success": False,
                "message": "Invalid password"
            }), 401
        

        return jsonify({
            "success": True,
            "roleid": user[0],
            "role": user[1],
            "eid": user[2],
            "username": user[3]
        })

    except Exception as e:
        print("LOGIN ERROR:", e)

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        if 'conn' in locals():
            cursor.close()
            conn.close()

# -----------------------------
# ADMIN STATS
# -----------------------------
@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM student")
        total_students = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM class")
        classes = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM biometric")
        enrolled = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*)
            FROM student s
            LEFT JOIN biometric b
                ON s.studentid = b.studentid
            WHERE b.studentid IS NULL
        """)
        not_enrolled = cursor.fetchone()[0]

        return jsonify({
            "success": True,
            "totalStudents": total_students,
            "classes": classes,
            "present": enrolled,
            "absent": not_enrolled
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        if 'conn' in locals():
            cursor.close()
            conn.close()


# -----------------------------
# GET ALL USERS
# -----------------------------
@app.route('/api/users', methods=['GET'])
def get_users():

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                e.eid,
                e.fullname,
                r.rolename,
                u.email
            FROM entity e
            LEFT JOIN role r
                ON e.roleid = r.roleid
            LEFT JOIN useraccount u
                ON e.eid = u.eid
            ORDER BY e.eid
        """)

        rows = cursor.fetchall()

        users = []

        for row in rows:
            users.append({
                "id": row[0],
                "name": row[1],
                "role": row[2],
                "email": row[3]
            })

        return jsonify({
            "success": True,
            "users": users
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        if 'conn' in locals():
            cursor.close()
            conn.close()


# -----------------------------
# GET STUDENTS
# -----------------------------
@app.route('/api/students', methods=['GET'])
def get_students():

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                s.studentid,
                e.fullname,
                u.email,
                e.gender,
                e.phonenumber,
                b.biometricid
            FROM student s
            JOIN entity e
                ON s.eid = e.eid

            LEFT JOIN useraccount u
                ON e.eid = u.eid

            LEFT JOIN biometric b
                ON s.studentid = b.studentid

            ORDER BY s.studentid
        """)

        rows = cursor.fetchall()

        students = []

        for row in rows:
            students.append({
                "id": row[0],
                "name": row[1],
                "role": "STUDENT",
                "email": row[2],
                "sex": row[3],
                "phone": row[4],
                "fingerprint_id": row[5]
            })

        return jsonify({
            "success": True,
            "users": students
        })

    except Exception as e:
        print("🚨 GET USERS ERROR:", e)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:
        if 'conn' in locals():
            cursor.close()
            conn.close()


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)