import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import { randomBytes, createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const dbPath = path.resolve(process.env.DATABASE_PATH || "./data/alpha-group.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS products(
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', price_paisa INTEGER NOT NULL CHECK(price_paisa>=0),
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), emoji TEXT NOT NULL DEFAULT '📦',
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE,
 customer_name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL,
 payment_method TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'pending',
 order_status TEXT NOT NULL DEFAULT 'pending', subtotal_paisa INTEGER NOT NULL,
 delivery_paisa INTEGER NOT NULL, total_paisa INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id),
 product_id INTEGER NOT NULL REFERENCES products(id), product_name TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0), unit_price_paisa INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admins(
 id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
 token_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admins(id), expires_at INTEGER NOT NULL
);
`);
if (!db.prepare("SELECT COUNT(*) n FROM products").get().n) {
 const add=db.prepare("INSERT INTO products(name,category,description,price_paisa,stock,emoji) VALUES(?,?,?,?,?,?)");
 const sample=[
  ["কটন টি-শার্ট","ফ্যাশন","আরামদায়ক দৈনন্দিন পোশাক",45000,20,"👕"],
  ["ওয়্যারলেস হেডফোন","ইলেকট্রনিক্স","দৈনন্দিন ব্যবহারের হেডফোন",125000,12,"🎧"],
  ["স্টিল ওয়াটার বোতল","লাইফস্টাইল","পুনর্ব্যবহারযোগ্য বোতল",38000,30,"🧴"],
  ["কিচেন স্টোরেজ সেট","ঘর ও রান্না","রান্নাঘর গুছিয়ে রাখার সেট",79000,15,"🍱"],
  ["ক্লাসিক ব্যাকপ্যাক","ফ্যাশন","দৈনন্দিন ব্যবহারের ব্যাগ",99000,10,"🎒"],
  ["স্মার্ট LED ল্যাম্প","ইলেকট্রনিক্স","ঘরের জন্য LED ল্যাম্প",68000,18,"💡"],
  ["সিরামিক কফি মগ","ঘর ও রান্না","সিরামিক মগ",25000,25,"☕"],
  ["গিফট সেট","লাইফস্টাইল","উপহার দেওয়ার সেট",85000,8,"🎁"]
 ];
 db.transaction(rows=>rows.forEach(p=>add.run(...p)))(sample);
}
if(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD &&
 !db.prepare("SELECT id FROM admins WHERE email=?").get(process.env.ADMIN_EMAIL.toLowerCase())) {
 db.prepare("INSERT INTO admins(email,password_hash) VALUES(?,?)")
   .run(process.env.ADMIN_EMAIL.toLowerCase(),bcrypt.hashSync(process.env.ADMIN_PASSWORD,12));
}
app.disable("x-powered-by");
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:"30kb"}));
app.use(cookieParser());
app.use(express.static(path.resolve("./public")));
app.use("/api/auth/login",rateLimit({windowMs:15*60*1000,limit:8}));
app.use("/api/admin",rateLimit({windowMs:15*60*1000,limit:100}));
const hash=s=>createHash("sha256").update(s).digest("hex");
function adminOnly(req,res,next){
 const token=req.cookies.alpha_admin;
 if(!token)return res.status(401).json({error:"অ্যাডমিন হিসেবে লগইন করুন।"});
 const user=db.prepare("SELECT admins.id,admins.email FROM sessions JOIN admins ON admins.id=sessions.admin_id WHERE token_hash=? AND expires_at>?").get(hash(token),Date.now());
 if(!user)return res.status(401).json({error:"সেশন শেষ হয়েছে, আবার লগইন করুন।"});
 req.admin=user;next();
}
const productOut=p=>({id:p.id,name:p.name,category:p.category,description:p.description,price:p.price_paisa/100,stock:p.stock,emoji:p.emoji});
app.get("/api/health",(_q,s)=>s.json({ok:true,service:"ALPHA GROUP"}));
app.get("/api/products",(_q,s)=>s.json(db.prepare("SELECT * FROM products WHERE active=1 ORDER BY id DESC").all().map(productOut)));
app.post("/api/auth/login",async(req,res)=>{
 const parsed=z.object({email:z.string().email().max(254),password:z.string().min(1).max(200)}).safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:"সঠিক ইমেইল ও পাসওয়ার্ড দিন।"});
 const u=db.prepare("SELECT * FROM admins WHERE email=?").get(parsed.data.email.toLowerCase());
 if(!u||!(await bcrypt.compare(parsed.data.password,u.password_hash)))return res.status(401).json({error:"লগইন তথ্য সঠিক নয়।"});
 const token=randomBytes(32).toString("base64url");
 db.prepare("INSERT INTO sessions(token_hash,admin_id,expires_at) VALUES(?,?,?)").run(hash(token),u.id,Date.now()+8*60*60*1000);
 res.cookie("alpha_admin",token,{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000,path:"/"});
 res.json({ok:true,email:u.email});
});
app.post("/api/auth/logout",(req,res)=>{
 if(req.cookies.alpha_admin)db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hash(req.cookies.alpha_admin));
 res.clearCookie("alpha_admin",{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/"});
 res.json({ok:true});
});
app.get("/api/admin/me",adminOnly,(req,res)=>res.json({email:req.admin.email}));
app.get("/api/admin/summary",adminOnly,(_q,res)=>{
 res.json({
  products:db.prepare("SELECT COUNT(*) n FROM products WHERE active=1").get().n,
  orders:db.prepare("SELECT COUNT(*) n FROM orders").get().n,
  pending:db.prepare("SELECT COUNT(*) n FROM orders WHERE order_status IN ('pending','processing')").get().n,
  paidRevenue:db.prepare("SELECT COALESCE(SUM(total_paisa),0) n FROM orders WHERE payment_status='paid'").get().n/100
 });
});
const productSchema=z.object({name:z.string().trim().min(2).max(120),category:z.string().trim().min(1).max(60),description:z.string().max(1000).default(""),price:z.number().finite().min(0).max(10000000),stock:z.number().int().min(0).max(1000000),emoji:z.string().max(12).default("📦")});
app.post("/api/admin/products",adminOnly,(req,res)=>{
 const x=productSchema.safeParse(req.body);if(!x.success)return res.status(400).json({error:"পণ্যের তথ্য সঠিক নয়।"});
 const p=x.data;const r=db.prepare("INSERT INTO products(name,category,description,price_paisa,stock,emoji) VALUES(?,?,?,?,?,?)").run(p.name,p.category,p.description,Math.round(p.price*100),p.stock,p.emoji);
 res.status(201).json({id:Number(r.lastInsertRowid)});
});
app.patch("/api/admin/products/:id",adminOnly,(req,res)=>{
 const x=productSchema.safeParse(req.body),id=Number(req.params.id);if(!x.success||!Number.isInteger(id))return res.status(400).json({error:"তথ্য সঠিক নয়।"});
 const p=x.data,r=db.prepare("UPDATE products SET name=?,category=?,description=?,price_paisa=?,stock=?,emoji=? WHERE id=? AND active=1").run(p.name,p.category,p.description,Math.round(p.price*100),p.stock,p.emoji,id);
 if(!r.changes)return res.status(404).json({error:"পণ্য পাওয়া যায়নি।"});res.json({ok:true});
});
app.delete("/api/admin/products/:id",adminOnly,(req,res)=>{
 const r=db.prepare("UPDATE products SET active=0 WHERE id=?").run(Number(req.params.id));if(!r.changes)return res.status(404).json({error:"পণ্য পাওয়া যায়নি।"});res.json({ok:true});
});
app.get("/api/admin/orders",adminOnly,(_q,res)=>{
 const orders=db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 200").all(),getItems=db.prepare("SELECT * FROM order_items WHERE order_id=?");
 res.json(orders.map(o=>({...o,subtotal:o.subtotal_paisa/100,delivery:o.delivery_paisa/100,total:o.total_paisa/100,items:getItems.all(o.id)})));
});
const orderSchema=z.object({
 customerName:z.string().trim().min(2).max(100),
 phone:z.string().trim().regex(/^[0-9+\-\s()]{8,20}$/),
 address:z.string().trim().min(8).max(600),
 paymentMethod:z.enum(["cod","online"]),
 items:z.array(z.object({productId:z.number().int().positive(),quantity:z.number().int().min(1).max(30)})).min(1).max(50)
});
app.post("/api/orders",(req,res)=>{
 const x=orderSchema.safeParse(req.body);if(!x.success)return res.status(400).json({error:"অর্ডারের তথ্য যাচাই করুন।"});
 try{
  const result=db.transaction(()=>{
   let subtotal=0;const found=[];
   for(const i of x.data.items){const p=db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(i.productId);if(!p)throw Error("পণ্য পাওয়া যায়নি।");if(p.stock<i.quantity)throw Error(`${p.name}: পর্যাপ্ত স্টক নেই।`);subtotal+=p.price_paisa*i.quantity;found.push({p,q:i.quantity});}
   const delivery=subtotal>=300000?0:8000,code="AG"+Date.now().toString().slice(-8)+randomBytes(2).toString("hex").toUpperCase();
   const r=db.prepare("INSERT INTO orders(code,customer_name,phone,address,payment_method,payment_status,order_status,subtotal_paisa,delivery_paisa,total_paisa) VALUES(?,?,?,?,?,'pending','pending',?,?,?)").run(code,x.data.customerName,x.data.phone,x.data.address,x.data.paymentMethod,subtotal,delivery,subtotal+delivery);
   const itemAdd=db.prepare("INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_paisa) VALUES(?,?,?,?,?)"),decrease=db.prepare("UPDATE products SET stock=stock-? WHERE id=? AND stock>=?");
   for(const {p,q} of found){itemAdd.run(Number(r.lastInsertRowid),p.id,p.name,q,p.price_paisa);if(!decrease.run(q,p.id,q).changes)throw Error("স্টক আপডেট হয়নি, আবার চেষ্টা করুন।");}
   return {code,total:(subtotal+delivery)/100,method:x.data.paymentMethod};
  })();
  res.status(201).json({ok:true,orderCode:result.code,total:result.total,paymentStatus:"pending",message:result.method==="cod"?"অর্ডার গ্রহণ করা হয়েছে।":"অর্ডার তৈরি হয়েছে; পেমেন্ট গেটওয়ে সংযুক্ত না হওয়া পর্যন্ত টাকা কাটা হবে না।"});
 }catch(e){res.status(400).json({error:e.message||"অর্ডার তৈরি হয়নি।"});}
});
app.patch("/api/admin/orders/:id",adminOnly,(req,res)=>{
 const x=z.object({orderStatus:z.enum(["pending","processing","shipped","delivered","cancelled"]),paymentStatus:z.enum(["pending","paid","failed","refunded"]).optional()}).safeParse(req.body);
 if(!x.success)return res.status(400).json({error:"অর্ডারের তথ্য সঠিক নয়।"});
 const r=db.prepare("UPDATE orders SET order_status=?,payment_status=COALESCE(?,payment_status) WHERE id=?").run(x.data.orderStatus,x.data.paymentStatus||null,Number(req.params.id));
 if(!r.changes)return res.status(404).json({error:"অর্ডার পাওয়া যায়নি।"});res.json({ok:true});
});
app.get("*",(_q,res)=>res.sendFile(path.resolve("./public/index.html")));
app.listen(PORT,()=>console.log(`ALPHA GROUP running at http://localhost:${PORT}`));
