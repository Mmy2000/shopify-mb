# My Scan - Verify Old QR Code Setup Guide

## What Was Added

1. **"Verify Old QR Code" Button** - Added to the scan page landing view
2. **Old QR Form View** - New page when clicked that shows input fields for customer data
3. **Supabase Integration** - Saves customer data to Supabase database

## How It Works

1. User clicks "Verify Old QR Code" button on my-scan page
2. User enters serial number from their gold bar
3. User fills in personal details (name, email, phone)
4. Form submits and saves data to Supabase `old_qr_submissions` table
5. Data can be exported to Excel from Supabase dashboard

## Setup Instructions

### 1. Create Supabase Table

Run the SQL in `supabase-setup.sql` file in your Supabase SQL Editor:
- Go to Supabase Dashboard → SQL Editor
- Copy and paste the contents of `supabase-setup.sql`
- Click "Run" to create the table

### 2. Update Supabase Configuration

Edit `assets/my-scan.js` around **line 15-16** and update these lines:

```javascript
// Supabase Configuration - Update these with your actual credentials
// Get these from: Supabase Dashboard → Settings → API
this.supabaseUrl = 'https://db.sdwtcrhofxkmlakegjrx.supabase.co';
this.supabaseKey = 'YOUR_SUPABASE_ANON_KEY_HERE';  // ← UPDATE THIS
```

To get your Supabase anon key:
1. Go to Supabase Dashboard → Settings → API
2. Copy the "anon/public" key (starts with `eyJ...`)
3. Replace `'YOUR_SUPABASE_ANON_KEY_HERE'` with your actual key (keep the quotes)

**Example:**
```javascript
this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.xxxxxxx';
```

### 3. Customize Table Name (Optional)

If you want to use a different table name, update this line in `assets/my-scan.js`:

```javascript
this.supabaseTable = 'old_qr_submissions';
```

### 4. Table Schema

The `old_qr_submissions` table has these fields:
- `id` - Auto-incrementing ID
- `serial_number` - Customer's gold bar serial number
- `customer_name` - Customer's full name
- `customer_email` - Customer's email address
- `customer_phone` - Customer's phone number
- `submitted_at` - Timestamp when form was submitted

### 5. Manage Submissions

View and export data from Supabase Dashboard:
1. Go to Supabase Dashboard → Table Editor
2. Click on `old_qr_submissions` table
3. Export data as CSV:
   - Click "Export" button in top right
   - Choose CSV format
   - Download and open in Excel

## Testing

1. Load your my-scan page
2. Click "Verify Old QR Code" button
3. Fill in the form with test data
4. Check Supabase Dashboard → Table Editor → old_qr_submissions
5. Verify the data appears in the table

## Troubleshooting

### Form Submit Button Not Working
- Make sure you've updated the `supabaseKey` with your actual key
- Check browser console for errors (F12 → Console tab)

### Data Not Saving to Supabase
- Ensure RLS policies are configured correctly (run the SQL script)
- Check that the table name matches your Supabase table
- Verify your Supabase project URL and key are correct

### Excel Export Issues
- Export from Supabase as CSV instead
- Open CSV in Excel
- Or use Supabase's built-in export feature

## Customization

### Change Form Fields
Edit `sections/my-scan.liquid` → Look for `data-old-qr-form` and modify the input fields as needed.

### Add New Fields
1. Update the HTML form in `sections/my-scan.liquid`
2. Update the Supabase table structure with ALTER TABLE command
3. Update the form submission logic in `assets/my-scan.js`

## Support

For Supabase integration help:
- Supabase Docs: https://supabase.com/docs
- Supabase SQL Docs: https://supabase.com/docs/guides/database/sql
