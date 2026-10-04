import React from "react";
import { motion } from "framer-motion";
import { Folder, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ProjectCard({
  project,
  creationCount,
  thumbnails,
  onDelete,
  index = 0,
}) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -3 }}
      onClick={() => navigate(`/projects/${project.id}`)}
      className="group cursor-pointer rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-primary/40 transition-colors"
    >
      <div className="aspect-video bg-secondary/30 grid grid-cols-2 grid-rows-2 gap-0.5">
        {thumbnails.slice(0, 4).map((url, i) => (
          <div key={i} className="overflow-hidden bg-secondary/40">
            <img src={url} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
        {thumbnails.length === 0 && (
          <div className="col-span-2 row-span-2 flex items-center justify-center">
            <Folder className="w-10 h-10 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-heading font-semibold truncate">
              {project.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {creationCount} creation{creationCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {project.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {project.description}
          </p>
        )}
      </div>
    </motion.div>
  );
}
