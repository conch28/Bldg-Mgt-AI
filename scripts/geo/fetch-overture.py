# Extracts one Overture Maps theme/type for a bounding box (env BBOX=lon0,lon1,lat0,lat1) into a parquet file.
# Usage: BBOX=... python3 fetch-overture.py <theme> <type> <out.parquet>
import sys, pyarrow.fs as pafs, pyarrow.parquet as pq, pyarrow as pa
from concurrent.futures import ThreadPoolExecutor
theme, typ, out = sys.argv[1], sys.argv[2], sys.argv[3]
import os
X0, X1, Y0, Y1 = [float(v) for v in os.environ.get("BBOX","120.44,120.62,15.27,15.43").split(",")]
s3=pafs.S3FileSystem(anonymous=True, region='us-west-2')
base=f'overturemaps-us-west-2/release/2026-11-18.0/theme={theme}/type={typ}/'
files=[i.path for i in s3.get_file_info(pafs.FileSelector(base)) if i.path.endswith('.parquet')]
def stat(md, rg, name):
    r=md.row_group(rg)
    for c in range(r.num_columns):
        col=r.column(c)
        if col.path_in_schema==name: return col.statistics
def work(path):
    f=pq.ParquetFile(s3.open_input_file(path))
    md=f.metadata; rgs=[]
    for rg in range(md.num_row_groups):
        a=stat(md,rg,'bbox.xmin'); b=stat(md,rg,'bbox.xmax'); c=stat(md,rg,'bbox.ymin'); d=stat(md,rg,'bbox.ymax')
        if a is None or not a.has_min_max: rgs.append(rg); continue
        if a.min>X1 or b.max<X0 or c.min>Y1 or d.max<Y0: continue
        rgs.append(rg)
    if not rgs: return None
    t=f.read_row_groups(rgs)
    bb=t.column('bbox').combine_chunks()
    import pyarrow.compute as pc
    xmin=bb.field('xmin'); xmax=bb.field('xmax'); ymin=bb.field('ymin'); ymax=bb.field('ymax')
    m=pc.and_(pc.and_(pc.less_equal(xmin,X1),pc.greater_equal(xmax,X0)),pc.and_(pc.less_equal(ymin,Y1),pc.greater_equal(ymax,Y0)))
    t=t.filter(m)
    return t if t.num_rows else None
with ThreadPoolExecutor(32) as ex: res=[r for r in ex.map(work, files) if r is not None]
t=pa.concat_tables(res, promote_options='permissive') if res else None
print(theme,typ, t.num_rows if t is not None else 0)
if t is not None: pq.write_table(t,out)
